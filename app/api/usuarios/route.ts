import { NextRequest, NextResponse } from 'next/server';
import { getUsuarioById, updateUsuario, deleteUsuario, getAllUsuarios } from '@/lib/discord';
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
  try {
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

    // ── ADMIN: promover/rebaixar usuário ──
    if (action === 'promover') {
      if (!canDo(session.role, 'promover')) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      
      const { usuario_id, novo_role, barbeiro_id, unidade_id } = body;
      const novoRole = novo_role as UserRole;
      
      // Gerente não pode promover para dono ou rebaixar outros gerentes/donos
      if (session.role === 'gerente') {
        if (novoRole === 'dono') return NextResponse.json({ error: 'Gerentes não podem criar donos' }, { status: 403 });
      }
      
      const alvo = await getUsuarioById(usuario_id);
      if (!alvo) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      
      // Não pode promover alguém de nível igual ou maior (exceto dono)
      if (session.role !== 'dono' && ROLE_LEVEL[alvo.role] >= ROLE_LEVEL[session.role]) {
        return NextResponse.json({ error: 'Sem permissão para alterar este usuário' }, { status: 403 });
      }
      
      alvo.role = novoRole;
      if (barbeiro_id !== undefined) alvo.barbeiro_id = barbeiro_id || null;
      if (unidade_id !== undefined) alvo.unidade_id = unidade_id || null;
      await updateUsuario(alvo);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
