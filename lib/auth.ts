// lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { UserRole } from './discord';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
);

export interface JWTPayload {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET) as Promise<string>;
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('reggae_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Permissões por nível
export const ROLE_LEVEL: Record<UserRole, number> = {
  cliente: 0,
  barbeiro: 1,
  gerente: 2,
  dono: 3,
};

export function canDo(role: UserRole, action: 'cancelar_proprio' | 'cancelar_alheio' | 'ver_todos_ag' | 'gerenciar_usuarios' | 'promover' | 'acesso_admin'): boolean {
  const lvl = ROLE_LEVEL[role];
  switch (action) {
    case 'cancelar_proprio': return lvl >= 0;       // qualquer um
    case 'cancelar_alheio': return lvl >= 1;        // barbeiro+
    case 'ver_todos_ag':    return lvl >= 1;        // barbeiro+
    case 'gerenciar_usuarios': return lvl >= 2;     // gerente+
    case 'promover':        return lvl >= 2;        // gerente+ (mas gerente não pode criar dono)
    case 'acesso_admin':    return lvl >= 1;        // barbeiro+
    default: return false;
  }
}
