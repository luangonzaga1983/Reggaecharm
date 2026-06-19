import { NextRequest, NextResponse } from 'next/server';
import { getMaintenanceConfig } from '@/lib/discord';
import { err } from '@/lib/api';
import type { Session } from '@/types';

/**
 * Resolve IP do cliente respeitando headers de proxy confiáveis.
 * Em produção atrás de CDN (Cloudflare/Vercel), confiar primeiro nesses.
 */
export function clientIp(req: NextRequest): string {
  // NÃO confiar em cf-connecting-ip / x-real-ip: sem Cloudflare na frente, esses
  // headers são controlados pelo cliente e permitiriam burlar rate-limit, lockout
  // e ban por IP. Usa o IP da borda (req.ip) e, na falta, a 1ª entrada do
  // x-forwarded-for setada pela Vercel.
  const direct = (req as unknown as { ip?: string }).ip;
  if (direct) return direct;
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return 'unknown';
}

/**
 * Verifica magic bytes contra MIME declarado.
 * Bloqueia uploads de arquivos disfarçados (ex: .php renomeado .jpg).
 */
export function verifyImageMagic(buf: ArrayBuffer, mime: string): boolean {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b.length < 4) return false;
  if (mime === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === 'image/png') {
    return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
      && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
  }
  if (mime === 'image/gif') {
    return b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38
      && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61;
  }
  if (mime === 'image/webp') {
    return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
      && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  }
  return false;
}

/**
 * Bloqueia API requests durante manutenção, exceto para dono.
 * Retorna NextResponse 503 se bloqueado, ou null se OK.
 */
export async function maintenanceGuard(session: Session | null): Promise<NextResponse | null> {
  try {
    const maint = await getMaintenanceConfig();
    if (!maint.ativo) return null;
    if (session?.role === 'dono') return null;
    return NextResponse.json(
      { error: maint.mensagem || 'Site em manutenção.', maintenance: true },
      { status: 503, headers: { 'Retry-After': '300' } },
    );
  } catch {
    return null; // fail-open se Discord cair (UX > segurança aqui)
  }
}

/**
 * Comparação string em tempo constante para evitar timing attacks.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Sanitiza erros internos antes de logar. Não loga senhas/tokens/cookies.
 */
const SENSITIVE_KEYS = /senha|password|token|secret|authorization|cookie|bearer/i;

export function safeError(e: unknown): Record<string, unknown> {
  if (!e || typeof e !== 'object') return { message: String(e) };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e as any)) {
    if (SENSITIVE_KEYS.test(k)) continue;
    if (typeof v === 'string' && v.length > 500) out[k] = v.slice(0, 500) + '…';
    else if (typeof v !== 'function') out[k] = v;
  }
  if ((e as any).message) out.message = (e as any).message;
  return out;
}
