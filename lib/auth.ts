import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { Session, UserRole } from '@/types';
import { ROLE_LEVEL } from '@/utils';

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET not set');
  return new TextEncoder().encode(s);
};

const COOKIE = 'reggae_token';
const MAX_AGE = 30 * 24 * 60 * 60; // 30d

export async function signToken(payload: Session): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret()) as Promise<string>;
}

export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
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

export function setCookie(res: Response, token: string) {
  res.headers.set('Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`);
}

export function clearCookie(res: Response) {
  res.headers.set('Set-Cookie',
    `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

export { ROLE_LEVEL };

export function canDo(role: UserRole, action: 'cancelar_proprio' | 'cancelar_alheio' | 'ver_todos_ag' | 'gerenciar_usuarios' | 'promover' | 'acesso_admin'): boolean {
  const lvl = ROLE_LEVEL[role];
  switch (action) {
    case 'cancelar_proprio':   return lvl >= 0;
    case 'cancelar_alheio':    return lvl >= 1;
    case 'ver_todos_ag':       return lvl >= 1;
    case 'gerenciar_usuarios': return lvl >= 2;
    case 'promover':           return lvl >= 2;
    case 'acesso_admin':       return lvl >= 2;
    default: return false;
  }
}
