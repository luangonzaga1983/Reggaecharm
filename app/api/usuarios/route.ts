import { NextRequest, NextResponse } from 'next/server';
import {
  getUsuarioById, updateUsuario, deleteUsuario, getAllUsuarios,
  getUsuarioByUsername, uploadUserPhoto, banirUsuario, desbanirUsuario,
} from '@/lib/discord';
import { getSession, canDo, ROLE_LEVEL } from '@/lib/auth';
import { ok, err, unauth, forbidden, notFound, serverErr } from '@/lib/api';
import { validateRole, validateUsername, validateNome, validatePassword, validateImageFile, sanitizeString } from '@/validators';
import type { UserRole } from '@/types';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauth();

  try {
    if (new URL(req.url).searchParams.get('action') === 'todos') {
      if (!canDo(session.role, 'gerenciar_usuarios')) return forbidden();
      const all = await getAllUsuarios();
      return NextResponse.json({ usuarios: all.map(({ senha: _, ...u }) => u) });
    }

    const u = await getUsuarioById(session.id);
    if (!u) return notFound();
    const { senha: _, ...safe } = u;
    return NextResponse.json({ usuario: safe });
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
      const file = form.get('foto') as File | null;
      if (!file) return err('Foto obrigatória');

      const imgErr = validateImageFile(file);
      if (imgErr) return err(imgErr);

      const u = await getUsuarioById(session.id);
      if (!u) return notFound();
      const url = await uploadUserPhoto(u, await file.arrayBuffer(), file.name, file.type || 'image/jpeg');
      return ok({ foto_url: url });
    }

    const body = await req.json().catch(() => null);
    if (!body) return err('Payload inválido');
    const { action } = body;
    const u = await getUsuarioById(session.id);
    if (!u) return notFound();

    if (action === 'prefs') {
      const fields = ['barbeiro_favorito','servico_favorito','horario_favorito','unidade_favorita','tema'] as const;
      fields.forEach(f => { if (f in body) (u as any)[f] = body[f]; });
      await updateUsuario(u);
      const { senha: _, ...safe } = u;
      return ok({ usuario: safe });
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
      const { senha: _, ...safe } = u;
      return ok({ usuario: safe });
    }

    if (action === 'senha') {
      const { senha_atual, senha_nova } = body;
      if (typeof senha_atual !== 'string' || !senha_atual) return err('Senha atual obrigatória');
      if (!validatePassword(senha_nova)) return err('Nova senha deve ter 6-128 caracteres');
      if (!(await bcrypt.compare(senha_atual, u.senha))) return err('Senha atual incorreta');
      u.senha = await bcrypt.hash(senha_nova, 12);
      await updateUsuario(u);
      return ok();
    }

    if (action === 'excluir') {
      if (!u._messageId) return notFound();
      await deleteUsuario(u._messageId);
      const res = ok();
      res.cookies.set('reggae_token', '', { maxAge: 0, path: '/' });
      return res;
    }

    if (action === 'promover') {
      if (!canDo(session.role, 'promover')) return forbidden();
      const novoRole = validateRole(body.novo_role);
      if (!novoRole) return err('Role inválido');
      if (session.role === 'gerente' && novoRole === 'dono') return forbidden();

      const alvo = await getUsuarioById(sanitizeString(body.usuario_id, 64));
      if (!alvo) return notFound();
      if (session.role !== 'dono' && ROLE_LEVEL[alvo.role] >= ROLE_LEVEL[session.role]) return forbidden();

      alvo.role = novoRole;
      if (body.barbeiro_id !== undefined) alvo.barbeiro_id = sanitizeString(body.barbeiro_id, 64) || null;
      if (body.unidade_id  !== undefined) alvo.unidade_id  = sanitizeString(body.unidade_id, 64) || null;
      await updateUsuario(alvo);
      return ok();
    }

    if (action === 'banir') {
      if (session.role !== 'dono' && session.role !== 'gerente') return forbidden();
      const alvo = await getUsuarioById(sanitizeString(body.usuario_id, 64));
      if (!alvo) return notFound();
      if (alvo.role === 'dono') return forbidden();
      if (session.role === 'gerente' && alvo.role === 'gerente') return forbidden();
      await banirUsuario(alvo, sanitizeString(body.motivo, 300) || 'Sem motivo informado', sanitizeString(body.ban_ip, 64) || undefined);
      return ok();
    }

    if (action === 'desbanir') {
      if (session.role !== 'dono' && session.role !== 'gerente') return forbidden();
      const alvo = await getUsuarioById(sanitizeString(body.usuario_id, 64));
      if (!alvo) return notFound();
      await desbanirUsuario(alvo);
      return ok();
    }

    return err('Ação inválida');
  } catch (e) {
    console.error('[usuarios POST]', e);
    return serverErr();
  }
}
