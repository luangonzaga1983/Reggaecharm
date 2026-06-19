import { NextRequest, NextResponse } from 'next/server';
import { getAllBarbeiros, getBarbeiroById, updateBarbeiro, uploadBarberPhoto, getUsuarioById, getMediaEstrelas, getAvaliacaoBarbeiro, upsertAvaliacaoBarbeiro } from '@/lib/discord';
import { removerBarbeiroCompleto } from '@/lib/barbeiros';
import { getLiveSession, getSession, canDo } from '@/lib/auth';
import { ok, err, unauth, forbidden, notFound, serverErr } from '@/lib/api';
import { auditFromSession } from '@/lib/audit';
import { clientIp, verifyImageMagic, maintenanceGuard } from '@/lib/security';
import { sanitizeString, validateImageFile, validateDate, validateTime, validateStars } from '@/validators';
import { hojeSP } from '@/lib/datetime';
import type { FolgaBlock } from '@/types';

const MAX_FOLGAS = 30; // limite p/ não estourar o JSON inline do Discord (~1900 chars)

/** Normaliza/valida lista de folgas vinda do cliente; poda datas passadas. */
function sanitizeFolgas(input: unknown): FolgaBlock[] {
  if (!Array.isArray(input)) return [];
  const hoje = hojeSP();
  const out: FolgaBlock[] = [];
  for (const f of input.slice(0, MAX_FOLGAS)) {
    if (!f || typeof f !== 'object') continue;
    const dia_todo = !!(f as any).dia_todo;
    let inicio: string | undefined, fim: string | undefined;
    if (!dia_todo) {
      const i = validateTime((f as any).inicio);
      const m = validateTime((f as any).fim);
      if (!i || !m || i >= m) continue; // faixa inválida → descarta
      inicio = i; fim = m;
    }
    if ((f as any).tipo === 'semanal') {
      const wd = Number((f as any).weekday);
      if (!Number.isInteger(wd) || wd < 0 || wd > 6) continue;
      out.push({ tipo: 'semanal', weekday: wd, dia_todo, inicio, fim });
    } else if ((f as any).tipo === 'data') {
      const d = validateDate((f as any).data);
      if (!d || d < hoje) continue; // poda passadas
      out.push({ tipo: 'data', data: d, dia_todo, inicio, fim });
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id    = sanitizeString(searchParams.get('id'), 64);
  const aval  = sanitizeString(searchParams.get('aval'), 64);
  const todos = searchParams.get('todos') === '1';
  try {
    if (aval) {
      // Avaliação: média/total global do barbeiro + a nota do usuário logado.
      const { media, total } = await getMediaEstrelas(aval);
      const session = await getSession();
      let minha: number | null = null;
      if (session) minha = (await getAvaliacaoBarbeiro(aval, session.id))?.estrelas ?? null;
      return NextResponse.json({ media, total, minha });
    }
    if (id) {
      const b = await getBarbeiroById(id);
      return b ? NextResponse.json({ barbeiro: b }) : notFound();
    }
    const all = await getAllBarbeiros();
    return NextResponse.json({ barbeiros: todos ? all : all.filter(b => b.ativo) });
  } catch {
    return serverErr();
  }
}

export async function POST(req: NextRequest) {
  const session = await getLiveSession();
  if (!session) return unauth();
  const blocked = await maintenanceGuard(session);
  if (blocked) return blocked;
  const ip = clientIp(req);
  const ua = req.headers.get('user-agent') || undefined;

  try {
    if (req.headers.get('content-type')?.includes('multipart/form-data')) {
      const form = await req.formData();
      const barbeiroId = sanitizeString(form.get('barbeiro_id'), 64);
      const file = form.get('foto') as File | null;
      if (!barbeiroId || !file) return err('barbeiro_id e foto são obrigatórios');

      const imgErr = validateImageFile(file);
      if (imgErr) return err(imgErr);

      if (!canDo(session.role, 'acesso_admin')) {
        if (session.role !== 'barbeiro') return forbidden();
        const u = await getUsuarioById(session.id);
        if (u?.barbeiro_id !== barbeiroId) return forbidden();
      }

      const barbeiro = await getBarbeiroById(barbeiroId);
      if (!barbeiro) return notFound();
      const buf = await file.arrayBuffer();
      if (!verifyImageMagic(buf, file.type)) return err('Conteúdo de imagem inválido');
      const url = await uploadBarberPhoto(barbeiro, buf, file.name, file.type || 'image/jpeg');
      auditFromSession(session, 'photo_upload', { target_id: barbeiroId, ip, ua });
      return ok({ photo_url: url });
    }

    const raw = await req.text();
    if (raw.length > 16_000) return err('Payload muito grande');
    const body = raw ? JSON.parse(raw) : null;
    if (!body || typeof body !== 'object') return err('Payload inválido');
    const { action } = body;

    // Avaliar barbeiro: QUALQUER usuário logado, 1 nota por barbeiro (upsert).
    if (action === 'avaliar') {
      const barbeiroId = sanitizeString(body.barbeiro_id, 64);
      const estrelas = validateStars(body.estrelas);
      if (!barbeiroId) return err('barbeiro_id obrigatório');
      if (estrelas === null) return err('Estrelas inválidas (1-5)');
      const b = await getBarbeiroById(barbeiroId);
      if (!b) return notFound();
      const u = await getUsuarioById(session.id);
      if (u?.barbeiro_id === barbeiroId) return err('Você não pode avaliar a si mesmo', 403);
      await upsertAvaliacaoBarbeiro(barbeiroId, session.id, estrelas);
      const { media, total } = await getMediaEstrelas(barbeiroId);
      return ok({ media, total, minha: estrelas });
    }

    // Demais ações exigem admin (gerente+/dono).
    if (!canDo(session.role, 'acesso_admin')) return forbidden();

    // Criação avulsa de barbeiro foi removida: barbeiro agora é sempre uma conta
    // de usuário promovida ao cargo 'barbeiro' (cria/vincula o registro em
    // /api/usuarios action=promover). Isso evita barbeiros órfãos sem login.
    if (action === 'criar') {
      return err('Crie barbeiros promovendo um usuário ao cargo Barbeiro (aba Usuários).', 400);
    }

    if (action === 'editar') {
      const id = sanitizeString(body.barbeiro_id, 64);
      const b  = await getBarbeiroById(id);
      if (!b) return notFound();
      if (body.nome !== undefined) {
        const n = sanitizeString(body.nome, 100);
        if (!n) return err('Nome inválido');
        b.nome = n;
      }
      if (Array.isArray(body.especialidades)) {
        b.especialidades = body.especialidades.map((e: unknown) => sanitizeString(e, 60)).filter(Boolean).slice(0, 30);
      }
      if (Array.isArray(body.unidades)) {
        b.unidades = body.unidades.map((u: unknown) => sanitizeString(u, 64)).filter(Boolean).slice(0, 50);
      }
      if (body.ativo !== undefined) b.ativo = !!body.ativo;
      if (body.almoco !== undefined) {
        if (body.almoco === null) {
          b.almoco = null;
        } else {
          const ini = validateTime(body.almoco?.inicio);
          const fim = validateTime(body.almoco?.fim);
          if (!ini || !fim || ini >= fim) return err('Horário de almoço inválido');
          b.almoco = { inicio: ini, fim };
        }
      }
      if (body.folgas !== undefined) b.folgas = sanitizeFolgas(body.folgas);
      await updateBarbeiro(b);
      return ok({ barbeiro: b });
    }

    if (action === 'deletar') {
      const b = await getBarbeiroById(sanitizeString(body.barbeiro_id, 64));
      if (!b) return notFound();
      b.ativo = false;
      await updateBarbeiro(b);
      auditFromSession(session, 'config_change', { target_id: b.id, target_label: b.nome, meta: { entity: 'barbeiro', op: 'deletar' }, ip, ua });
      return ok();
    }

    if (action === 'excluir') {
      // Exclusão PERMANENTE (registro + foto + realocação de clientes). gerente+.
      const b = await getBarbeiroById(sanitizeString(body.barbeiro_id, 64));
      if (!b?._messageId) return notFound();
      const { removidas, realocados } = await removerBarbeiroCompleto(b.id);
      if (removidas === 0) return err('Não foi possível remover o barbeiro. Tente de novo.', 500);
      auditFromSession(session, 'config_change', { target_id: b.id, target_label: b.nome, meta: { entity: 'barbeiro', op: 'excluir', realocados }, ip, ua });
      return ok({ realocados });
    }

    return err('Ação inválida');
  } catch (e) {
    console.error('[barbeiros POST]', e);
    return serverErr();
  }
}
