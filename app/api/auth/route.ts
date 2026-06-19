import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import {
  createUsuario, getUsuarioByEmail, getAllUsuarios, getUsuarioById, getMaintenanceConfig,
} from '@/lib/discord';
import { signToken, getSession, cookieOptions, COOKIE_NAME } from '@/lib/auth';
import { ok, err, serverErr } from '@/lib/api';
import { audit, auditFromSession } from '@/lib/audit';
import { clientIp } from '@/lib/security';
import { lockRemaining, registerFail, clearFails } from '@/lib/lockout';
import { validateEmail, validatePassword, validateNome, sanitizeString } from '@/validators';
import { isPasswordPwned } from '@/lib/pwned';

// Tempo mínimo de processamento para login (~250ms) — neutraliza timing attacks
// que medem a diferença entre "usuário existe + senha errada" e "usuário não existe".
async function constantTimeFloor<T>(p: Promise<T>, minMs = 250): Promise<T> {
  const start = Date.now();
  const out = await p;
  const elapsed = Date.now() - start;
  if (elapsed < minMs) await new Promise(r => setTimeout(r, minMs - elapsed));
  return out;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const ua = req.headers.get('user-agent') || undefined;

  try {
    const raw = await req.text();
    if (raw.length > 8_000) return err('Payload muito grande');
    const body = raw ? JSON.parse(raw) : null;
    if (!body || typeof body !== 'object') return err('Payload inválido');

    const { action } = body;

    if (action === 'registro') {
      // Honeypot: campo invisível que humano nunca preenche. Bot que varre o form
      // costuma preencher tudo → se vier algo, é bot. Resposta genérica (não revela).
      if (typeof body.website === 'string' && body.website.trim() !== '') {
        return err('Não foi possível concluir o cadastro. Verifique seus dados ou tente fazer login.', 400);
      }

      const nome  = validateNome(body.nome);
      const email = validateEmail(body.email);
      if (!nome)  return err('Nome inválido');
      if (!email) return err('E-mail inválido');
      if (!validatePassword(body.senha)) return err('Senha deve ter 8-128 caracteres');
      if (await isPasswordPwned(body.senha)) {
        return err('Essa senha já apareceu em vazamentos de dados. Escolha uma senha diferente.', 400);
      }

      // Mensagem genérica anti-enumeração (não revela se e-mail já existe)
      const existing = await getUsuarioByEmail(email);
      if (existing) {
        audit({
          ts: '', actor_id: null, actor_role: null, action: 'register',
          meta: { result: 'email_taken', email_hash: hashEmail(email) }, ip, ua,
        });
        // 200 OK genérico — não confirma nem nega existência ao atacante
        return err('Não foi possível concluir o cadastro. Verifique seus dados ou tente fazer login.', 400);
      }

      const device_hash = sanitizeString(body.device_hash, 128) || null;
      const todos = await getAllUsuarios();

      // Bloquear cadastro se IP atualmente banido
      if (todos.some(u => u.banido && u.ban_ip && u.ban_ip === ip)) {
        audit({ ts: '', actor_id: null, actor_role: null, action: 'register',
          meta: { result: 'ip_banned' }, ip, ua });
        return err('Cadastro indisponível.', 403);
      }

      if (device_hash && todos.some(u => u.device_hash === device_hash)) {
        return err('Já existe conta neste dispositivo', 409);
      }

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

      audit({
        ts: '', actor_id: usuario.id, actor_role: usuario.role, action: 'register',
        target_id: usuario.id, target_label: email, ip, ua,
      });

      const res = ok();
      res.cookies.set(COOKIE_NAME, await signToken({ id: usuario.id, email, nome, role: usuario.role, tv: usuario.token_version ?? 0 }), cookieOptions());
      return res;
    }

    if (action === 'login') {
      return await constantTimeFloor(handleLogin(body, ip, ua));
    }

    if (action === 'logout') {
      const session = await getSession();
      if (session) auditFromSession(session, 'logout', { ip, ua });
      const res = ok();
      res.cookies.set(COOKIE_NAME, '', { ...cookieOptions(), maxAge: 0 });
      // Defesa em profundidade: manda o navegador limpar cookies do site no logout.
      res.headers.set('Clear-Site-Data', '"cookies"');
      return res;
    }

    return err('Ação inválida');
  } catch (e) {
    console.error('[auth POST]', e);
    return serverErr();
  }
}

async function handleLogin(body: any, ip: string, ua?: string): Promise<NextResponse> {
  const email = validateEmail(body.email);
  if (!email) return err('E-mail ou senha inválidos', 401);
  if (typeof body.senha !== 'string' || !body.senha.length) return err('E-mail ou senha inválidos', 401);

  // Lockout por conta (backoff exponencial) — checado ANTES do bcrypt.
  // Chave combina e-mail + IP: trava a conta-alvo sem permitir que um atacante
  // bloqueie a vítima legítima de outro IP (mitiga DoS de lockout do OWASP).
  const lockKey = `${email}|${ip}`;
  const locked = lockRemaining(lockKey);
  if (locked > 0) {
    audit({
      ts: '', actor_id: null, actor_role: null, action: 'login',
      meta: { result: 'locked', email_hash: hashEmail(email), ms: locked }, ip, ua,
    });
    return err(`Muitas tentativas. Tente de novo em ${Math.ceil(locked / 1000)}s.`, 429);
  }

  const usuario = await getUsuarioByEmail(email);
  // bcrypt.compare em qualquer caso para evitar timing attack (em conjunto com constantTimeFloor)
  const fakeHash = '$2a$12$invalidsaltinvalidsaltinvxXxYyZzAaBbCcDdEeFfGg0123456789';
  const passOk = await bcrypt.compare(body.senha, usuario?.senha || fakeHash);

  if (!usuario || !passOk) {
    const lockMs = registerFail(lockKey);
    audit({
      ts: '', actor_id: null, actor_role: null, action: 'login',
      meta: { result: 'fail', email_hash: hashEmail(email), locked_ms: lockMs }, ip, ua,
    });
    return err('E-mail ou senha inválidos', 401);
  }

  // Sucesso: zera o histórico de falhas da conta.
  clearFails(lockKey);

  if (usuario.banido) {
    audit({
      ts: '', actor_id: usuario.id, actor_role: usuario.role, action: 'login',
      meta: { result: 'banned' }, target_id: usuario.id, ip, ua,
    });
    return err(`Conta banida. Motivo: ${usuario.ban_motivo || 'Violação dos termos de uso'}`, 403);
  }

  // Bloqueio por IP banido (qualquer conta com este IP marcado como banida)
  const todos = await getAllUsuarios();
  if (todos.some(u => u.banido && u.ban_ip && u.ban_ip === ip)) {
    audit({
      ts: '', actor_id: usuario.id, actor_role: usuario.role, action: 'login',
      meta: { result: 'ip_blocked' }, target_id: usuario.id, ip, ua,
    });
    return err('Acesso negado.', 403);
  }

  audit({
    ts: '', actor_id: usuario.id, actor_role: usuario.role ?? 'cliente', action: 'login',
    meta: { result: 'ok' }, target_id: usuario.id, ip, ua,
  });

  const res = ok();
  res.cookies.set(
    COOKIE_NAME,
    await signToken({ id: usuario.id, email, nome: usuario.nome, role: usuario.role ?? 'cliente', tv: usuario.token_version ?? 0 }),
    cookieOptions(),
  );
  return res;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ session: null });

    const usuario = await getUsuarioById(session.id);
    // Discord pode falhar transientemente — só desloga se realmente banido
    if (!usuario) {
      return NextResponse.json({ session });
    }
    if (usuario.banido) {
      const res = NextResponse.json({ session: null, banned: true, motivo: usuario.ban_motivo });
      res.cookies.set(COOKIE_NAME, '', { ...cookieOptions(), maxAge: 0 });
      return res;
    }

    // Sessão revogada (ban/troca de senha/rebaixamento bumparam token_version)
    if ((usuario.token_version ?? 0) !== (session.tv ?? 0)) {
      const res = NextResponse.json({ session: null, revoked: true });
      res.cookies.set(COOKIE_NAME, '', { ...cookieOptions(), maxAge: 0 });
      return res;
    }

    const liveRole = usuario.role ?? 'cliente';

    const maint = await getMaintenanceConfig();
    if (maint.ativo && liveRole !== 'dono')
      return NextResponse.json({ session: null, maintenance: true, mensagem: maint.mensagem });

    return NextResponse.json({ session: { ...session, role: liveRole, nome: usuario.nome } });
  } catch (e) {
    console.error('[auth GET]', e);
    return serverErr();
  }
}

/**
 * Hash não-criptográfico para logar referência de e-mail sem PII completa.
 * Usado em logs de auditoria (logins falhos, etc.).
 */
function hashEmail(email: string): string {
  let h = 5381;
  for (let i = 0; i < email.length; i++) {
    h = ((h << 5) + h) ^ email.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16);
}
