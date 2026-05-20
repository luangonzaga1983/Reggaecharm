// Centralised validation — never trust the client
import type { UserRole } from '@/types';

const VALID_ROLES: UserRole[] = ['cliente', 'barbeiro', 'gerente', 'dono'];
const VALID_STATUS = ['confirmado', 'cancelado', 'pendente'] as const;

export const isString = (v: unknown): v is string => typeof v === 'string';
export const isNumber = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

export function sanitizeString(v: unknown, maxLen = 255): string {
  if (!isString(v)) return '';
  return v.trim().slice(0, maxLen).replace(/[<>]/g, '');
}

export function validateEmail(email: unknown): string | null {
  const s = sanitizeString(email, 254);
  if (!s || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s.toLowerCase();
}

export function validatePassword(senha: unknown): boolean {
  return isString(senha) && senha.length >= 6 && senha.length <= 128;
}

export function validateNome(nome: unknown): string | null {
  const s = sanitizeString(nome, 100);
  if (!s || s.length < 2) return null;
  return s;
}

export function validateUsername(username: unknown): string | null {
  if (!isString(username)) return null;
  const clean = username.replace(/^@/, '').toLowerCase().trim();
  if (!clean) return '';
  if (!/^[a-z0-9._]{3,30}$/.test(clean)) return null;
  return clean;
}

export function validateRole(role: unknown): UserRole | null {
  return VALID_ROLES.includes(role as UserRole) ? (role as UserRole) : null;
}

export function validateStatus(s: unknown): typeof VALID_STATUS[number] | null {
  return VALID_STATUS.includes(s as any) ? (s as typeof VALID_STATUS[number]) : null;
}

export function validateStars(v: unknown): number | null {
  if (!isNumber(v) || v < 1 || v > 5 || !Number.isInteger(v)) return null;
  return v;
}

export function validateDate(d: unknown): string | null {
  if (!isString(d) || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return d;
}

export function validateTime(t: unknown): string | null {
  if (!isString(t) || !/^\d{2}:(00|30)$/.test(t)) return null;
  const [h] = t.split(':').map(Number);
  if (h < 0 || h > 23) return null;
  return t;
}

export function validateImageFile(file: File): string | null {
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const MAX_SIZE = 8 * 1024 * 1024; // 8MB
  if (!ALLOWED.includes(file.type)) return 'Tipo de imagem inválido';
  if (file.size > MAX_SIZE) return 'Imagem muito grande (máx. 8MB)';
  return null;
}
