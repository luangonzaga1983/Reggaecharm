import { NextRequest, NextResponse } from 'next/server';
import { getAllBarbeiros, getBarbeiroById, createBarbeiro, updateBarbeiro, uploadBarberPhoto, getUsuarioById, deleteBarbeiro, getStoreConfig, saveStoreConfig, getAllAgendamentos, updateAgendamento, updateUsuario } from '@/lib/discord';
import { pushToUsuario } from '@/lib/push';
import { getLiveSession, canDo } from '@/lib/auth';
import { ok, err, unauth, forbidden, notFound, serverErr } from '@/lib/api';
import { auditFromSession } from '@/lib/audit';
import { clientIp, verifyImageMagic, maintenanceGuard } from '@/lib/security';
import { sanitizeString, validateImageFile, validateDate, validateTime } from '@/validators';
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
  const todos = searchParams.get('todos') === '1';
  try {
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

    if (!canDo(session.role, 'acesso_admin')) return forbidden();

    const raw = await req.text();
    if (raw.length > 16_000) return err('Payload muito grande');
    const body = raw ? JSON.parse(raw) : null;
    if (!body || typeof body !== 'object') return err('Payload inválido');
    const { action } = body;

    if (action === 'criar') {
      const nome = sanitizeString(body.nome, 100);
      if (!nome) return err('Nome é obrigatório');
      const especialidades = Array.isArray(body.especialidades)
        ? body.especialidades.map((e: unknown) => sanitizeString(e, 60)).filter(Boolean).slice(0, 30)
        : [];
      const unidades = Array.isArray(body.unidades)
        ? body.unidades.map((u: unknown) => sanitizeString(u, 64)).filter(Boolean).slice(0, 50)
        : [];
      const novo = await createBarbeiro({
        id: 'b' + crypto.randomUUID().replace(/-/g,'').slice(0,8),
        nome, especialidades, unidades,
        ativo: true,
        photo_message_id: null,
      });
      auditFromSession(session, 'config_change', { target_id: novo.id, target_label: nome, meta: { entity: 'barbeiro', op: 'criar' }, ip, ua });
      return ok({ barbeiro: novo });
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
      // Exclusão PERMANENTE (apaga registro + foto). gerente+ (já barrado acima).
      const b = await getBarbeiroById(sanitizeString(body.barbeiro_id, 64));
      if (!b?._messageId) return notFound();
      const removidas = await deleteBarbeiro(b.id);   // apaga todas (inclui duplicatas)
      if (removidas === 0) return err('Não foi possível remover o barbeiro. Tente de novo.', 500);

      // Faz sentido: tira o barbeiro das unidades também (sem refs órfãs).
      try {
        const cfg = await getStoreConfig();
        let mudou = false;
        const unidades = cfg.unidades.map(u => {
          const lista = Array.isArray(u.barbeiros) ? u.barbeiros : [];
          if (lista.includes(b.id)) { mudou = true; return { ...u, barbeiros: lista.filter(x => x !== b.id) }; }
          return u;
        });
        if (mudou) await saveStoreConfig({ ...cfg, unidades });
      } catch { /* limpeza best-effort */ }

      // Realocação dos clientes: cancela cortes futuros com este barbeiro, dá vale
      // de corte (valor do serviço) e notifica. Cliente remarca grátis depois.
      let realocados = 0;
      try {
        const hoje = hojeSP();
        const cfg2 = await getStoreConfig();
        const afetados = (await getAllAgendamentos({ fresh: true }))
          .filter(a => a.barbeiro_id === b.id && a.status !== 'cancelado' && a.data >= hoje && (a.presenca ?? 'pendente') === 'pendente')
          .slice(0, 300);
        for (const a of afetados) {
          a.status = 'cancelado';
          a.cancelado_motivo = 'barbeiro_removido';
          await updateAgendamento(a);
          // Crédito só do que ENTROU: pago = valor cheio vira crédito; não pago =
          // devolve só o crédito que já tinha sido abatido (não regala dinheiro).
          const reembolso = a.pago ? a.valor : Number(a.credito_usado ?? 0);
          const cli = await getUsuarioById(a.usuario_id);
          if (cli) {
            if (reembolso > 0) {
              cli.credito_saldo = Math.round((Number(cli.credito_saldo ?? 0) + reembolso) * 100) / 100;
              await updateUsuario(cli);
            }
            try {
              await pushToUsuario(a.usuario_id, {
                title: `Horário cancelado — ${cfg2.nome_loja}`,
                body: reembolso > 0
                  ? `O barbeiro ${b.nome} saiu e seu corte de ${a.data} às ${a.horario} foi cancelado. Devolvemos R$ ${reembolso.toFixed(2)} em crédito — abatido automático no próximo corte.`
                  : `O barbeiro ${b.nome} saiu e seu corte de ${a.data} às ${a.horario} foi cancelado. Reagende com outro profissional quando quiser.`,
                tag: `cancel-${a.id}`,
              });
            } catch { /* push opcional */ }
            realocados++;
          }
        }
      } catch (e) { console.error('[excluir barbeiro: realocação]', e); }

      auditFromSession(session, 'config_change', { target_id: b.id, target_label: b.nome, meta: { entity: 'barbeiro', op: 'excluir', realocados }, ip, ua });
      return ok({ realocados });
    }

    return err('Ação inválida');
  } catch (e) {
    console.error('[barbeiros POST]', e);
    return serverErr();
  }
}
