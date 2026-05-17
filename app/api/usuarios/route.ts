import { NextRequest, NextResponse } from 'next/server';
import { getUsuarioById, updateUsuario, deleteUsuario, getAllUsuarios, getUsuarioByUsername, uploadUserPhoto, banirUsuario, desbanirUsuario } from '@/lib/discord';
import { getSession, canDo, ROLE_LEVEL } from '@/lib/auth';
import type { UserRole } from '@/lib/discord';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    if (action === 'todos' && canDo(session.role, 'gerenciar_usuarios')) {
      const todos = await getAllUsuarios();
      const safe = todos.map(({ senha: _, ...u }) => u);
      return NextResponse.json({ usuarios: safe });
    }

    const usuario = await getUsuarioById(session.id);
    if (!usuario) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    const { senha: _, ...safe } = usuario;
    return NextResponse.json({ usuario: safe });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const contentType = req.headers.get('content-type') || '';

  try {
    // ── Upload de foto de perfil (multipart) ────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('foto') as File | null;
      if (!file) return NextResponse.json({ error: 'Foto obrigatória' }, { status: 400 });

      const usuario = await getUsuarioById(session.id);
      if (!usuario || !usuario._messageId) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

      const buffer = await file.arrayBuffer();
      const freshUrl = await uploadUserPhoto(
        usuario._messageId, usuario, buffer, file.name, file.type || 'image/jpeg',
      );

      return NextResponse.json({ ok: true, foto_url: freshUrl });
    }

    // ── JSON actions ────────────────────────────────────────────────────────
    const body = await req.json();
    const { action } = body;
    const usuario = await getUsuarioById(session.id);
    if (!usuario) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

    if (action === 'prefs') {
      if ('barbeiro_favorito' in body) usuario.barbeiro_favorito = body.barbeiro_favorito;
      if ('servico_favorito' in body) usuario.servico_favorito = body.servico_favorito;
      if ('horario_favorito' in body) usuario.horario_favorito = body.horario_favorito;
      if ('unidade_favorita' in body) usuario.unidade_favorita = body.unidade_favorita;
      if ('tema' in body) usuario.tema = body.tema;
      await updateUsuario(usuario);
      const { senha: _, ...safe } = usuario;
      return NextResponse.json({ ok: true, usuario: safe });
    }

    if (action === 'perfil') {
      const { nome, username } = body;
      if (nome?.trim()) usuario.nome = nome.trim();
      if (username !== undefined) {
        const clean = username.replace(/^@/, '').toLowerCase().trim();
        if (clean && clean !== usuario.username) {
          // Verifica unicidade
          const existing = await getUsuarioByUsername(clean);
          if (existing && existing.id !== session.id) {
            return NextResponse.json({ error: 'Este @ já está em uso' }, { status: 409 });
          }
          if (!/^[a-z0-9._]{3,30}$/.test(clean)) {
            return NextResponse.json({ error: '@username deve ter 3-30 caracteres: letras, números, . ou _' }, { status: 400 });
          }
          usuario.username = clean;
        } else if (!clean) {
          usuario.username = null;
        }
      }
      await updateUsuario(usuario);
      const { senha: _, ...safe } = usuario;
      return NextResponse.json({ ok: true, usuario: safe });
    }

    if (action === 'senha') {
      const { senha_atual, senha_nova } = body;
      if (!senha_atual || !senha_nova) return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 });
      const ok = await bcrypt.compare(senha_atual, usuario.senha);
      if (!ok) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 });
      usuario.senha = await bcrypt.hash(senha_nova, 12);
      await updateUsuario(usuario);
      return NextResponse.json({ ok: true });
    }

    if (action === 'excluir') {
      await deleteUsuario(usuario._messageId!);
      const res = NextResponse.json({ ok: true });
      res.cookies.set('reggae_token', '', { maxAge: 0, path: '/' });
      return res;
    }

    // ── ADMIN: promover ────────────────────────────────────────────────────
    if (action === 'promover') {
      if (!canDo(session.role, 'promover')) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      const { usuario_id, novo_role, barbeiro_id, unidade_id } = body;
      const novoRole = novo_role as UserRole;
      if (session.role === 'gerente' && novoRole === 'dono') {
        return NextResponse.json({ error: 'Gerentes não podem criar donos' }, { status: 403 });
      }
      const alvo = await getUsuarioById(usuario_id);
      if (!alvo) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      if (session.role !== 'dono' && ROLE_LEVEL[alvo.role] >= ROLE_LEVEL[session.role]) {
        return NextResponse.json({ error: 'Sem permissão para alterar este usuário' }, { status: 403 });
      }
      alvo.role = novoRole;
      if (barbeiro_id !== undefined) alvo.barbeiro_id = barbeiro_id || null;
      if (unidade_id !== undefined) alvo.unidade_id = unidade_id || null;
      await updateUsuario(alvo);
      return NextResponse.json({ ok: true });
    }

    if (action === 'banir') {
      if (session.role !== 'dono' && session.role !== 'gerente') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      const { usuario_id, motivo, ban_ip } = body;
      const alvo = await getUsuarioById(usuario_id);
      if (!alvo) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      if (alvo.role === 'dono') return NextResponse.json({ error: 'Não é possível banir o dono' }, { status: 403 });
      // At this point TypeScript knows alvo.role !== 'dono'
      if (session.role === 'gerente' && alvo.role === 'gerente') {
        return NextResponse.json({ error: 'Gerentes só podem banir clientes e barbeiros' }, { status: 403 });
      }
      await banirUsuario(alvo, motivo || 'Sem motivo informado', ban_ip);
      return NextResponse.json({ ok: true });
    }

    if (action === 'desbanir') {
      if (session.role !== 'dono' && session.role !== 'gerente') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      const { usuario_id } = body;
      const alvo = await getUsuarioById(usuario_id);
      if (!alvo) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      await desbanirUsuario(alvo);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
