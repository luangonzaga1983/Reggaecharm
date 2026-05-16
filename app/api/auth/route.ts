// app/api/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { createUsuario, getUsuarioByEmail } from '@/lib/discord';
import { signToken } from '@/lib/auth';

// POST /api/auth — { action: 'registro'|'login', ... }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'registro') {
      const { nome, email, senha } = body;

      if (!nome || !email || !senha) {
        return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
      }

      const existing = await getUsuarioByEmail(email);
      if (existing) {
        return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
      }

      const senhaHash = await bcrypt.hash(senha, 12);
      const usuario = await createUsuario({
        id: uuidv4(),
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        senha: senhaHash,
        barbeiro_favorito: null,
        pontos: 0,
      });

      const token = await signToken({ id: usuario.id, email: usuario.email, nome: usuario.nome });

      const res = NextResponse.json({ ok: true, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
      res.cookies.set('reggae_token', token, {
        httpOnly: true,
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
      });
      return res;
    }

    if (action === 'login') {
      const { email, senha } = body;

      if (!email || !senha) {
        return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
      }

      const usuario = await getUsuarioByEmail(email);
      if (!usuario) {
        return NextResponse.json({ error: 'E-mail ou senha inválidos' }, { status: 401 });
      }

      const ok = await bcrypt.compare(senha, usuario.senha);
      if (!ok) {
        return NextResponse.json({ error: 'E-mail ou senha inválidos' }, { status: 401 });
      }

      const token = await signToken({ id: usuario.id, email: usuario.email, nome: usuario.nome });

      const res = NextResponse.json({ ok: true, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
      res.cookies.set('reggae_token', token, {
        httpOnly: true,
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
      });
      return res;
    }

    if (action === 'logout') {
      const res = NextResponse.json({ ok: true });
      res.cookies.set('reggae_token', '', { maxAge: 0, path: '/' });
      return res;
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err) {
    console.error('[auth]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// GET /api/auth — retorna sessão atual
export async function GET() {
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ session: null });
  return NextResponse.json({ session });
}
