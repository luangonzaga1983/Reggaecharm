import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createUsuario, getUsuarioByEmail, getAllUsuarios, getUsuarioById, getMaintenanceConfig } from '@/lib/discord';
import { signToken, getSession } from '@/lib/auth';
import { ok, err, serverErr } from '@/lib/api';
import { validateEmail, validatePassword, validateNome, sanitizeString } from '@/validators';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return err('Payload inválido');

    const { action } = body;

    if (action === 'registro') {
      const nome  = validateNome(body.nome);
      const email = validateEmail(body.email);
      if (!nome)  return err('Nome inválido');
      if (!email) return err('E-mail inválido');
      if (!validatePassword(body.senha)) return err('Senha deve ter 6-128 caracteres');

      const existing = await getUsuarioByEmail(email);
      if (existing) return err('E-mail já cadastrado', 409);

      const device_hash = sanitizeString(body.device_hash, 128) || null;
      if (device_hash) {
        const todos = await getAllUsuarios();
        if (todos.some(u => u.device_hash === device_hash)) return err('Já existe conta neste dispositivo', 409);
      }

      const todos = await getAllUsuarios();
      const usuario = await createUsuario({
        id: crypto.randomUUID(),
        nome, email,
        senha: await bcrypt.hash(body.senha, 12),
        username: null, foto_url: null, device_hash,
        barbeiro_favorito: null, servico_favorito: null,
        horario_favorito: null, unidade_favorita: null,
        tema: 'dark', pontos: 0,
        role: todos.length === 0 ? 'dono' : 'cliente',
        barbeiro_id: null, unidade_id: null,
      });

      const res = ok();
      res.cookies.set('reggae_token', await signToken({ id: usuario.id, email, nome, role: usuario.role }), {
        httpOnly: true, path: '/', maxAge: 30 * 24 * 60 * 60, sameSite: 'lax',
      });
      return res;
    }

    if (action === 'login') {
      const email = validateEmail(body.email);
      if (!email) return err('Credenciais inválidas', 401);
      if (typeof body.senha !== 'string' || !body.senha.length) return err('Credenciais inválidas', 401);

      const usuario = await getUsuarioByEmail(email);
      if (!usuario || !(await bcrypt.compare(body.senha, usuario.senha)))
        return err('E-mail ou senha inválidos', 401);
      if (usuario.banido)
        return err(`Conta banida. Motivo: ${usuario.ban_motivo || 'Violação dos termos de uso'}`, 403);

      const res = ok();
      res.cookies.set('reggae_token', await signToken({ id: usuario.id, email, nome: usuario.nome, role: usuario.role ?? 'cliente' }), {
        httpOnly: true, path: '/', maxAge: 30 * 24 * 60 * 60, sameSite: 'lax',
      });
      return res;
    }

    if (action === 'logout') {
      const res = ok();
      res.cookies.set('reggae_token', '', { maxAge: 0, path: '/' });
      return res;
    }

    return err('Ação inválida');
  } catch (e) {
    console.error('[auth POST]', e);
    return serverErr();
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ session: null });

    const usuario = await getUsuarioById(session.id);
    if (usuario?.banido) {
      const res = NextResponse.json({ session: null, banned: true, motivo: usuario.ban_motivo });
      res.cookies.set('reggae_token', '', { maxAge: 0, path: '/' });
      return res;
    }

    const maint = await getMaintenanceConfig();
    if (maint.ativo && session.role !== 'dono')
      return NextResponse.json({ session: null, maintenance: true, mensagem: maint.mensagem });

    return NextResponse.json({ session });
  } catch (e) {
    console.error('[auth GET]', e);
    return serverErr();
  }
}
