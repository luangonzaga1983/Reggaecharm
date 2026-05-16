import { NextRequest, NextResponse } from 'next/server';
import { getUsuarioById, updateUsuario, deleteUsuario } from '@/lib/discord';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  try {
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
      const fields = ['barbeiro_favorito', 'servico_favorito', 'horario_favorito', 'unidade_favorita', 'tema'];
      for (const f of fields) if (f in body) (usuario as Record<string, unknown>)[f] = body[f];
      await updateUsuario(usuario);
      const { senha: _, ...safe } = usuario;
      return NextResponse.json({ ok: true, usuario: safe });
    }

    if (action === 'favoritar') {
      usuario.barbeiro_favorito = body.barbeiro_id || null;
      await updateUsuario(usuario);
      return NextResponse.json({ ok: true, barbeiro_favorito: usuario.barbeiro_favorito });
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

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
