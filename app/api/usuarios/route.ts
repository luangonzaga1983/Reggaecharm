import { NextRequest, NextResponse } from 'next/server';
import {
  getUsuarioById, updateUsuario, deleteUsuario, getAllUsuarios,
  getUsuarioByUsername, uploadUserPhoto, banirUsuario, desbanirUsuario,
} from '@/lib/discord';
import { getSession, canDo, ROLE_LEVEL, cookieOptions, COOKIE_NAME } from '@/lib/auth';
import { ok, err, unauth, forbidden, notFound, serverErr } from '@/lib/api';
import { auditFromSession, sanitizeUserOut } from '@/lib/audit';
import { clientIp, verifyImageMagic, maintenanceGuard } from '@/lib/security';
import { validateRole, validateUsername, validateNome, validatePassword, validateImageFile, sanitizeString } from '@/validators';
import type { TemaApp, UserRole } from '@/types';
import bcrypt from 'bcryptjs';

const TEMAS_VALIDOS: TemaApp[] = ['dark', 'light'];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauth();

  try {
    if (new URL(req.url).searchParams.get('action') === 'todos') {
      if (!canDo(session.role, 'gerenciar_usuarios')) {
        auditFromSession(session, 'admin_access_denied', { meta: { route: 'usuarios?todos' } });
        return forbidden();
      }
      const all = await getAllUsuarios();
      const isAdmin = ROLE_LEVEL[session.role] >= ROLE_LEVEL.gerente;
      return NextResponse.json({
        usuarios: all.map(u => sanitizeUserOut(u, { isAdmin })),
      });
    }

    const u = await getUsuarioById(session.id);
    if (!u) return notFound();
    return NextResponse.json({ usuario: sanitizeUserOut(u, { isSelf: true }) });
  } catch {
    return serverErr();
  }
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
      const file = form.get('foto') as File | null;
      if (!file) return err('Foto obrigatória');

      const imgErr = validateImageFile(file);
      if (imgErr) return err(imgErr);

      const u = await getUsuarioById(session.id);
      if (!u) return notFound();

      // Magic-byte check — confirma que bytes batem com MIME declarado
      const buf = await file.arrayBuffer();
      if (!verifyImageMagic(buf, file.type)) return err('Conteúdo de imagem inválido');

      const url = await uploadUserPhoto(u, buf, file.name, file.type || 'image/jpeg');
      auditFromSession(session, 'photo_upload', { target_id: u.id, ip, ua });
      return ok({ foto_url: url });
    }

    const raw = await req.text();
    if (raw.length > 16_000) return err('Payload muito grande');
    const body = raw ? JSON.parse(raw) : null;
    if (!body || typeof body !== 'object') return err('Payload inválido');
    const { action } = body;
    const u = await getUsuarioById(session.id);
    if (!u) return notFound();

    if (action === 'prefs') {
      if (body.barbeiro_favorito !== undefined) u.barbeiro_favorito = sanitizeString(body.barbeiro_favorito, 64) || null;
      if (body.servico_favorito  !== undefined) u.servico_favorito  = sanitizeString(body.servico_favorito, 64)  || null;
      if (body.horario_favorito  !== undefined) u.horario_favorito  = sanitizeString(body.horario_favorito, 8)   || null;
      if (body.unidade_favorita  !== undefined) u.unidade_favorita  = sanitizeString(body.unidade_favorita, 64)  || null;
      if (body.tema !== undefined && TEMAS_VALIDOS.includes(body.tema)) u.tema = body.tema;
      await updateUsuario(u);
      return ok({ usuario: sanitizeUserOut(u, { isSelf: true }) });
    }

    if (action === 'perfil') {
      const nome = validateNome(body.nome);
      if (nome) u.nome = nome;

      if (body.username !== undefined) {
        const clean = validateUsername(body.username);
        if (clean === null) return err('@username deve ter 3-30 chars: letras, números, . ou _');
        if (clean && clean !== u.username) {
          const taken = await getUsuarioByUsername(clean);
          if (taken && taken.id !== session.id) return err('Este @ já está em uso', 409);
          u.username = clean;
        } else if (!clean) {
          u.username = null;
        }
      }
      await updateUsuario(u);
      return ok({ usuario: sanitizeUserOut(u, { isSelf: true }) });
    }

    if (action === 'senha') {
      const { senha_atual, senha_nova } = body;
      if (typeof senha_atual !== 'string' || !senha_atual) return err('Senha atual obrigatória');
      if (!validatePassword(senha_nova)) return err('Nova senha deve ter 6-128 caracteres');
      if (senha_atual === senha_nova) return err('Nova senha deve ser diferente da atual');
      if (!(await bcrypt.compare(senha_atual, u.senha))) return err('Senha atual incorreta');
      u.senha = await bcrypt.hash(senha_nova, 12);
      await updateUsuario(u);
      return ok();
    }

    if (action === 'excluir') {
      if (u.role === 'dono') {
        const todos = await getAllUsuarios();
        const donos = todos.filter(x => x.role === 'dono');
        if (donos.length <= 1) return err('Você é o único dono. Promova outro usuário antes de excluir sua conta.');
      }
      if (!u._messageId) return notFound();
      await deleteUsuario(u._messageId);
      auditFromSession(session, 'delete_user', { target_id: u.id, target_label: u.email, ip, ua });
      const res = ok();
      res.cookies.set(COOKIE_NAME, '', { ...cookieOptions(), maxAge: 0 });
      return res;
    }

    if (action === 'apelido') {
      // Staff (barbeiro+) define apelido global do cliente.
      if (!canDo(session.role, 'ver_todos_ag')) return forbidden();
      const alvo = await getUsuarioById(sanitizeString(body.usuario_id, 64));
      if (!alvo) return notFound();
      alvo.apelido = sanitizeString(body.apelido, 40) || null;
      await updateUsuario(alvo);
      return ok({ usuario: sanitizeUserOut(alvo, {}) });
    }

    if (action === 'promover') {
      if (!canDo(session.role, 'promover')) {
        auditFromSession(session, 'admin_access_denied', { meta: { action: 'promover' }, ip, ua });
        return forbidden();
      }
      const novoRole = validateRole(body.novo_role);
      if (!novoRole) return err('Role inválido');
      if (novoRole === 'dono' && session.role !== 'dono') return forbidden();

      const alvoId = sanitizeString(body.usuario_id, 64);
      const alvo = await getUsuarioById(alvoId);
      if (!alvo) return notFound();
      if (session.role !== 'dono' && ROLE_LEVEL[alvo.role] >= ROLE_LEVEL[session.role]) return forbidden();
      if (session.role !== 'dono' && ROLE_LEVEL[novoRole] >= ROLE_LEVEL[session.role]) return forbidden();
      if (alvo.id === session.id && alvo.role === 'dono' && novoRole !== 'dono') {
        const todos = await getAllUsuarios();
        if (todos.filter(x => x.role === 'dono').length <= 1) return err('Promova outro dono antes de se rebaixar');
      }

      const roleAntes = alvo.role;
      alvo.role = novoRole;
      if (body.barbeiro_id !== undefined) alvo.barbeiro_id = sanitizeString(body.barbeiro_id, 64) || null;
      if (body.unidade_id  !== undefined) alvo.unidade_id  = sanitizeString(body.unidade_id, 64) || null;
      await updateUsuario(alvo);
      auditFromSession(
        session,
        ROLE_LEVEL[novoRole] > ROLE_LEVEL[roleAntes] ? 'promote' : 'demote',
        { target_id: alvo.id, target_label: alvo.email, meta: { from: roleAntes, to: novoRole }, ip, ua },
      );
      return ok();
    }

    if (action === 'banir') {
      if (!canDo(session.role, 'banir')) {
        auditFromSession(session, 'admin_access_denied', { meta: { action: 'banir' }, ip, ua });
        return forbidden();
      }
      const alvo = await getUsuarioById(sanitizeString(body.usuario_id, 64));
      if (!alvo) return notFound();
      if (alvo.role === 'dono') return forbidden();
      if (alvo.id === session.id) return err('Não pode se banir');
      if (session.role !== 'dono' && ROLE_LEVEL[alvo.role] >= ROLE_LEVEL[session.role]) return forbidden();
      const motivo = sanitizeString(body.motivo, 300) || 'Sem motivo informado';
      await banirUsuario(
        alvo,
        motivo,
        sanitizeString(body.ban_ip, 64) || undefined,
      );
      auditFromSession(session, 'ban', { target_id: alvo.id, target_label: alvo.email, meta: { motivo }, ip, ua });
      return ok();
    }

    if (action === 'desbanir') {
      if (!canDo(session.role, 'banir')) {
        auditFromSession(session, 'admin_access_denied', { meta: { action: 'desbanir' }, ip, ua });
        return forbidden();
      }
      const alvo = await getUsuarioById(sanitizeString(body.usuario_id, 64));
      if (!alvo) return notFound();
      await desbanirUsuario(alvo);
      auditFromSession(session, 'unban', { target_id: alvo.id, target_label: alvo.email, ip, ua });
      return ok();
    }

    return err('Ação inválida');
  } catch (e) {
    console.error('[usuarios POST]', e);
    return serverErr();
  }
}
