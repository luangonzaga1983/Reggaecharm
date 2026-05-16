// app/api/usuarios/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUsuarioById, updateUsuario } from '@/lib/discord';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const usuario = await getUsuarioById(session.id);
    if (!usuario) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    // Never return password
    const { senha: _, ...safe } = usuario;
    return NextResponse.json({ usuario: safe });
  } catch (err) {
    console.error('[usuarios GET]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'favoritar') {
      const { barbeiro_id } = body;
      const usuario = await getUsuarioById(session.id);
      if (!usuario) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

      usuario.barbeiro_favorito = barbeiro_id || null;
      await updateUsuario(usuario);

      return NextResponse.json({ ok: true, barbeiro_favorito: usuario.barbeiro_favorito });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err) {
    console.error('[usuarios POST]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
