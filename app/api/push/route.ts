import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ok, err, unauth, serverErr } from '@/lib/api';
import { savePushSub, deletePushSubByEndpoint, getPushSubsByUsuario } from '@/lib/discord';
import { pushPublicKey } from '@/lib/push';

export async function GET(req: NextRequest) {
  if (new URL(req.url).searchParams.get('action') === 'key') {
    return NextResponse.json({ key: pushPublicKey() });
  }
  return err('Ação inválida');
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauth();
  try {
    const raw = await req.text();
    if (raw.length > 4_000) return err('Payload muito grande');
    const body = raw ? JSON.parse(raw) : null;
    if (!body || typeof body !== 'object') return err('Payload inválido');

    if (body.action === 'subscribe') {
      const sub = body.subscription;
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return err('Subscription inválida');
      await savePushSub({
        id: crypto.randomUUID(),
        usuario_id: session.id,
        endpoint: String(sub.endpoint).slice(0, 1000),
        p256dh: String(sub.keys.p256dh).slice(0, 200),
        auth: String(sub.keys.auth).slice(0, 100),
        created_at: new Date().toISOString(),
      });
      return ok();
    }

    if (body.action === 'unsubscribe') {
      // IDOR fix: só remove se o endpoint for de uma inscrição DESTE usuário.
      if (typeof body.endpoint === 'string') {
        const minhas = await getPushSubsByUsuario(session.id);
        if (minhas.some(s => s.endpoint === body.endpoint)) {
          await deletePushSubByEndpoint(body.endpoint);
        }
      }
      return ok();
    }

    return err('Ação inválida');
  } catch (e) {
    console.error('[push POST]', e);
    return serverErr();
  }
}
