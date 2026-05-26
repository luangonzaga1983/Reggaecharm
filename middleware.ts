import { NextRequest, NextResponse } from 'next/server';

// ─── Rate limit store (in-memory; per-instance) ──────────────────────────────
type Hit = { count: number; reset: number };
const hits = new Map<string, Hit>();
const MAX_KEYS = 50_000;

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Bounded cleanup: when map grows, sweep expired entries
  if (hits.size > MAX_KEYS) {
    hits.forEach((v, k) => { if (now > v.reset) hits.delete(k); });
    // If still too big after sweep, drop oldest by clearing fully (fail-open)
    if (hits.size > MAX_KEYS) hits.clear();
  }

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
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // browsers omitem em same-origin GET/POST
  const host = req.headers.get('host');
  if (!host) return false;
  try {
    const o = new URL(origin);
    return o.host === host;
  } catch { return false; }
}

const BLOCKED_UA = /sqlmap|nikto|nmap|masscan|zgrab|hydra|acunetix|nessus|wpscan|dirbuster|gobuster|wfuzz|burpsuite|havij|whatweb|qualys|openvas|nuclei|httpx|ffuf|feroxbuster|arachni|skipfish|netsparker|appscan/i;

const PROD = process.env.NODE_ENV === 'production';

// CSP — restritivo em prod; permite eval em dev (Next.js HMR)
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://cdn.discordapp.com https://media.discordapp.net",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  PROD
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' https://discord.com https://cdn.discordapp.com https://media.discordapp.net",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join('; ');

function applySecurityHeaders(res: NextResponse) {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=(), browsing-topics=()'
  );
  res.headers.set('Content-Security-Policy', CSP);
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  res.headers.set('X-DNS-Prefetch-Control', 'off');
  res.headers.set('X-Download-Options', 'noopen');
  res.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  res.headers.set('X-XSS-Protection', '0'); // modern browsers: legacy filter off
  res.headers.set('Origin-Agent-Cluster', '?1');
}

// Bloquear paths suspeitos comuns
const SUSPICIOUS_PATHS = /\/(\.env|\.git|wp-admin|wp-login|phpmyadmin|\.aws|\.ssh|backup\.sql|admin\.php|\.well-known\/security\.php)/i;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = clientIp(req);
  const ua = req.headers.get('user-agent') || '';

  // Block known scanners and reconnaissance paths
  if (BLOCKED_UA.test(ua)) return new NextResponse(null, { status: 403 });
  if (SUSPICIOUS_PATHS.test(pathname)) return new NextResponse(null, { status: 404 });

  // Block requests with no UA (most scrapers/bots)
  if (!ua && pathname.startsWith('/api/')) {
    return new NextResponse(null, { status: 403 });
  }

  // ── API routes: hardened ────────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const res = NextResponse.next();
    applySecurityHeaders(res);
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.headers.set('Pragma', 'no-cache');

    // CSRF: bloqueia mutações cross-origin
    if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) {
      return new NextResponse(JSON.stringify({ error: 'Origin não permitida' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Bloquear métodos não usados
    const ALLOWED_METHODS = new Set(['GET', 'POST', 'HEAD', 'OPTIONS']);
    if (!ALLOWED_METHODS.has(req.method)) {
      return new NextResponse(null, { status: 405 });
    }

    // Limite estrito SÓ para mutações de auth (login/registro/logout via POST).
    // O GET /api/auth é apenas leitura de sessão — roda a cada load/poll e não
    // pode ser throttled, senão o cliente leva "Muitas tentativas" só navegando.
    if (pathname.startsWith('/api/auth') && req.method === 'POST') {
      if (!rateLimit(`auth:${ip}`, 20, 15 * 60 * 1000)) {
        return new NextResponse(JSON.stringify({ error: 'Muitas tentativas. Aguarde.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '900' },
        });
      }
    }

    if (!rateLimit(`api:${ip}`, 120, 60_000)) {
      return new NextResponse(JSON.stringify({ error: 'Limite de requisições atingido.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    // Limite extra severo de burst (anti-DoS): 30 req em 5s
    if (!rateLimit(`burst:${ip}`, 30, 5_000)) {
      return new NextResponse(JSON.stringify({ error: 'Slow down.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '5' },
      });
    }

    return res;
  }

  // ── Páginas: aplicar headers de segurança ───────────────────────────────────
  const res = NextResponse.next();
  applySecurityHeaders(res);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
