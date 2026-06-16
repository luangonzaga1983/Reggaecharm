import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { Session, UserRole } from '@/types';
import { ROLE_LEVEL } from '@/utils';

const PROD = process.env.NODE_ENV === 'production';

const secret = () => {
  const s = process.env.JWT_SECRET;
  // Em produção exigimos 64+ chars (256+ bits de entropia real); dev aceita 32.
  const min = PROD ? 64 : 32;
  if (!s || s.length < min) throw new Error(`JWT_SECRET missing or too short (>=${min} chars)`);
  return new TextEncoder().encode(s);
};

// Em produção usa o prefixo __Host- (liga o cookie a Secure + Path=/ + sem Domain,
// impede sobrescrita por subdomínio). Em dev (http://localhost) o prefixo __Host-
// exige Secure, que não é setado → o navegador rejeitaria o cookie e o login
// quebraria. Por isso o nome é condicional ao ambiente.
const COOKIE  = PROD ? '__Host-reggae_token' : 'reggae_token';
const MAX_AGE = 7 * 24 * 60 * 60; // 7d
const ISSUER  = 'reggae-charm';
const AUD     = 'reggae-charm-app';
const ALG     = 'HS256';

export const COOKIE_NAME = COOKIE;

export async function signToken(payload: Session): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: ALG, typ: 'JWT' })
    .setJti(crypto.randomUUID())   // identificador único por token (anti-replay/rastreio)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUD)
    .setExpirationTime('7d')
    .sign(secret()) as Promise<string>;
}

export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUD,
      algorithms: [ALG],   // allowlist explícita — bloqueia alg-confusion ("none"/RS256→HS256)
      clockTolerance: 0,   // sem folga de relógio
      typ: 'JWT',
    });
    if (!payload.id || !payload.role) return null;
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  // Next 15: cookies() é assíncrono.
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Sessão "viva": valida o JWT E reconfere o usuário no banco a cada request.
 * - Bloqueia conta banida na hora (não espera o token expirar).
 * - Usa o ROLE REAL do banco (rebaixamento vale imediatamente, não o role do JWT).
 * - Confere token_version → revoga sessões antigas após ban/troca-de-senha.
 *
 * Fail-open só quando o banco está indisponível de fato (lookup lança/retorna
 * null por falha transiente do Discord) — aí cai pro JWT, como o GET /api/auth
 * já fazia. Use em TODA rota de mutação sensível (substitui getSession()).
 */
export async function getLiveSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  try {
    const { getUsuarioById } = await import('@/lib/discord');
    const u = await getUsuarioById(session.id);
    if (!u) return session; // Discord transiente → não desloga à toa
    if (u.banido) return null;
    if ((u.token_version ?? 0) !== (session.tv ?? 0)) return null; // revogado
    return { ...session, role: u.role ?? 'cliente', nome: u.nome };
  } catch {
    return session; // banco fora do ar → não trava o app
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    maxAge: MAX_AGE,
    // Strict em prod (defesa CSRF máxima); lax em dev pra não atrapalhar o fluxo local.
    sameSite: (PROD ? 'strict' : 'lax') as 'strict' | 'lax',
    secure: PROD,
  };
}

export { ROLE_LEVEL };

export type Action =
  | 'cancelar_proprio' | 'cancelar_alheio' | 'ver_todos_ag'
  | 'gerenciar_usuarios' | 'promover' | 'acesso_admin'
  | 'config_loja' | 'manutencao' | 'banir';

export function canDo(role: UserRole, action: Action): boolean {
  if (role === 'dono') return true; // dono pode tudo
  const lvl = ROLE_LEVEL[role];
  switch (action) {
    case 'cancelar_proprio':   return lvl >= 0;
    case 'cancelar_alheio':    return lvl >= 1;
    case 'ver_todos_ag':       return lvl >= 1;
    case 'gerenciar_usuarios': return lvl >= 2;
    case 'promover':           return lvl >= 2;
    case 'acesso_admin':       return lvl >= 2;
    case 'banir':              return lvl >= 2;
    case 'config_loja':        return false;
    case 'manutencao':         return false;
    default: return false;
  }
}
