import { NextRequest, NextResponse } from 'next/server';
import { getAllBarbeiros, getBarbeiroById, createBarbeiro, updateBarbeiro, uploadBarberPhoto, getUsuarioById } from '@/lib/discord';
import { getSession, canDo } from '@/lib/auth';
import { ok, err, unauth, forbidden, notFound, serverErr } from '@/lib/api';
import { sanitizeString, validateImageFile } from '@/validators';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id   = sanitizeString(searchParams.get('id'), 64);
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
  const session = await getSession();
  if (!session) return unauth();

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
      const url = await uploadBarberPhoto(barbeiro, await file.arrayBuffer(), file.name, file.type || 'image/jpeg');
      return ok({ photo_url: url });
    }

    if (!canDo(session.role, 'acesso_admin')) return forbidden();

    const body = await req.json().catch(() => null);
    if (!body) return err('Payload inválido');
    const { action } = body;

    if (action === 'criar') {
      const nome = sanitizeString(body.nome, 100);
      if (!nome) return err('Nome é obrigatório');
      const novo = await createBarbeiro({
        id: 'b' + crypto.randomUUID().replace(/-/g,'').slice(0,8),
        nome,
        especialidades: Array.isArray(body.especialidades) ? body.especialidades.map((e: unknown) => sanitizeString(e, 60)).filter(Boolean) : [],
        unidades:       Array.isArray(body.unidades)       ? body.unidades.map((u: unknown) => sanitizeString(u, 64)).filter(Boolean) : [],
        ativo: true,
        photo_message_id: null,
      });
      return ok({ barbeiro: novo });
    }

    if (action === 'editar') {
      const id = sanitizeString(body.barbeiro_id, 64);
      const b  = await getBarbeiroById(id);
      if (!b) return notFound();
      if (body.nome          !== undefined) b.nome          = sanitizeString(body.nome, 100) || b.nome;
      if (body.especialidades !== undefined) b.especialidades = body.especialidades;
      if (body.unidades       !== undefined) b.unidades       = body.unidades;
      if (body.ativo          !== undefined) b.ativo          = !!body.ativo;
      await updateBarbeiro(b);
      return ok({ barbeiro: b });
    }

    if (action === 'deletar') {
      const b = await getBarbeiroById(sanitizeString(body.barbeiro_id, 64));
      if (!b) return notFound();
      b.ativo = false;
      await updateBarbeiro(b);
      return ok();
    }

    return err('Ação inválida');
  } catch (e) {
    console.error('[barbeiros POST]', e);
    return serverErr();
  }
}
