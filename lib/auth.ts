import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { Session, UserRole } from '@/types';
import { ROLE_LEVEL } from '@/utils';

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET missing or too short (>=32 chars)');
  return new TextEncoder().encode(s);
};

const COOKIE  = 'reggae_token';
const MAX_AGE = 7 * 24 * 60 * 60; // 7d — sessões mais curtas reduzem risco de roubo
const ISSUER  = 'reggae-charm';
const AUD     = 'reggae-charm-app';

export const COOKIE_NAME = COOKIE;

export async function signToken(payload: Session): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUD)
    .setExpirationTime('7d')
    .sign(secret()) as Promise<string>;
}

export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, audience: AUD });
    if (!payload.id || !payload.role) return null;
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    maxAge: MAX_AGE,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
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
