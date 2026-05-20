import { NextRequest, NextResponse } from 'next/server';
import { getFotosByBarbeiro, createFotoBarbeiro, deleteFotoBarbeiro, getUsuarioById } from '@/lib/discord';
import { getSession } from '@/lib/auth';
import { ok, err, unauth, forbidden, serverErr } from '@/lib/api';
import { sanitizeString, validateImageFile } from '@/validators';

export async function GET(req: NextRequest) {
  const id = sanitizeString(new URL(req.url).searchParams.get('barbeiro_id'), 64);
  if (!id) return err('barbeiro_id obrigatório');
  try {
    return NextResponse.json({ fotos: await getFotosByBarbeiro(id) });
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
      const descricao  = sanitizeString(form.get('descricao'), 300);
      const file = form.get('foto') as File | null;
      if (!barbeiroId || !file) return err('barbeiro_id e foto são obrigatórios');

      const imgErr = validateImageFile(file);
      if (imgErr) return err(imgErr);

      if (session.role === 'cliente') return forbidden();
      if (session.role === 'barbeiro') {
        const u = await getUsuarioById(session.id);
        if (u?.barbeiro_id !== barbeiroId) return forbidden();
      }

      const foto = await createFotoBarbeiro(barbeiroId, descricao, await file.arrayBuffer(), file.name, file.type || 'image/jpeg');
      return ok({ foto });
    }

    const body = await req.json().catch(() => null);
    if (body?.action === 'deletar') {
      const msgId     = sanitizeString(body.message_id, 64);
      const barbeiroId = sanitizeString(body.barbeiro_id, 64);
      if (!msgId) return err('message_id obrigatório');

      if (session.role === 'cliente') return forbidden();
      if (session.role === 'barbeiro') {
        const u = await getUsuarioById(session.id);
        if (u?.barbeiro_id !== barbeiroId) return forbidden();
      }

      await deleteFotoBarbeiro(msgId);
      return ok();
    }

    return err('Ação inválida');
  } catch (e) {
    console.error('[fotos POST]', e);
    return serverErr();
  }
}
