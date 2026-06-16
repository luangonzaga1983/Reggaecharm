import { NextRequest, NextResponse } from 'next/server';
import { getFotosByBarbeiro, createFotoBarbeiro, deleteFotoBarbeiro, getUsuarioById } from '@/lib/discord';
import { getSession, canDo } from '@/lib/auth';
import { ok, err, unauth, forbidden, serverErr } from '@/lib/api';
import { auditFromSession } from '@/lib/audit';
import { clientIp, verifyImageMagic, maintenanceGuard } from '@/lib/security';
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

async function checaPermissao(session: { role: string; id: string }, barbeiroId: string): Promise<boolean> {
  if (session.role === 'dono') return true;
  if (canDo(session.role as any, 'acesso_admin')) return true;
  if (session.role === 'barbeiro') {
    const u = await getUsuarioById(session.id);
    return u?.barbeiro_id === barbeiroId;
  }
  return false;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauth();
  const blocked = await maintenanceGuard(session);
  if (blocked) return blocked;
  const ip = clientIp(req);
  const ua = req.headers.get('user-agent') || undefined;

  try {
    if (req.headers.get('content-type')?.includes('multipart/form-data')) {
      const form = await req.formData();
      const barbeiroId = sanitizeString(form.get('barbeiro_id'), 64);
      const descricao  = sanitizeString(form.get('descricao'), 300);
      const file = form.get('foto') as File | null;
      if (!barbeiroId || !file) return err('barbeiro_id e foto são obrigatórios');

      const imgErr = validateImageFile(file);
      if (imgErr) return err(imgErr);

      if (!(await checaPermissao(session, barbeiroId))) return forbidden();

      const buf = await file.arrayBuffer();
      if (!verifyImageMagic(buf, file.type)) return err('Conteúdo de imagem inválido');
      const foto = await createFotoBarbeiro(barbeiroId, descricao, buf, file.name, file.type || 'image/jpeg');
      auditFromSession(session, 'photo_upload', { target_id: barbeiroId, meta: { foto_id: foto.id }, ip, ua });
      return ok({ foto });
    }

    const raw = await req.text();
    if (raw.length > 2_000) return err('Payload muito grande');
    const body = raw ? JSON.parse(raw) : null;
    if (body?.action === 'deletar') {
      const msgId      = sanitizeString(body.message_id, 64);
      const barbeiroId = sanitizeString(body.barbeiro_id, 64);
      if (!msgId) return err('message_id obrigatório');
      if (!(await checaPermissao(session, barbeiroId))) return forbidden();
      await deleteFotoBarbeiro(msgId);
      auditFromSession(session, 'photo_delete', { target_id: barbeiroId, meta: { msg_id: msgId }, ip, ua });
      return ok();
    }

    return err('Ação inválida');
  } catch (e) {
    console.error('[fotos POST]', e);
    return serverErr();
  }
}
