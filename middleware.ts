import { NextRequest, NextResponse } from 'next/server';

// ─── In-memory rate limiter (resets on deploy, good enough for edge) ──────────
const hits = new Map<string, { count: number; reset: number }>();

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now > rec.reset) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (rec.count >= limit) return false;
  rec.count++;
  return true;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = clientIp(req);

  // ── API routes only ─────────────────────────────────────────────────────────
  if (!pathname.startsWith('/api/')) return NextResponse.next();

  const res = NextResponse.next();

  // Security headers on every API response
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Cache-Control', 'no-store');

  // ── Rate limiting ───────────────────────────────────────────────────────────
  // Auth endpoints: stricter (20 req / 15 min per IP)
  if (pathname.startsWith('/api/auth')) {
    if (!rateLimit(`auth:${ip}`, 20, 15 * 60 * 1000)) {
      return new NextResponse(JSON.stringify({ error: 'Muitas tentativas. Aguarde.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '900' },
      });
    }
  }

  // General API: 120 req / min per IP
  if (!rateLimit(`api:${ip}`, 120, 60_000)) {
    return new NextResponse(JSON.stringify({ error: 'Limite de requisições atingido.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  // ── Block obviously malicious payloads ──────────────────────────────────────
  const ua = req.headers.get('user-agent') || '';
  if (/sqlmap|nikto|nmap|masscan|zgrab|hydra/i.test(ua)) {
    return new NextResponse(null, { status: 403 });
  }

  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
