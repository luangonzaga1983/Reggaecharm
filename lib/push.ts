import webpush from 'web-push';
import {
  getAllPushSubs, getPushSubsByUsuario, getAllUsuarios, deletePushSub,
} from '@/lib/discord';
import type { PushSub } from '@/types';

let configured = false;
function ensure(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC;
  const priv = process.env.VAPID_PRIVATE;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@reggaecharm.app', pub, priv);
  configured = true;
  return true;
}

export function pushEnabled(): boolean {
  return !!(process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE);
}
export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC || null;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
}

async function sendTo(subs: PushSub[], payload: PushPayload): Promise<void> {
  if (!ensure() || !subs.length) return;
  const data = JSON.stringify({ icon: '/icon-192.png', url: '/', ...payload });
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        data,
      );
    } catch (e: any) {
      // 404/410 = inscrição expirada → remove para não tentar de novo
      if ((e?.statusCode === 404 || e?.statusCode === 410) && s._messageId) {
        await deletePushSub(s._messageId).catch(() => {});
      }
    }
  }));
}

/** Push best-effort para 1 usuário (todos os dispositivos dele). Nunca lança. */
export async function pushToUsuario(usuarioId: string, payload: PushPayload): Promise<void> {
  try { await sendTo(await getPushSubsByUsuario(usuarioId), payload); }
  catch (e) { console.error('[push usuario]', e); }
}

/** Push best-effort para todos os donos. Nunca lança. */
export async function pushToDonos(payload: PushPayload): Promise<void> {
  try {
    const [subs, users] = await Promise.all([getAllPushSubs(), getAllUsuarios()]);
    const donoIds = new Set(users.filter(u => u.role === 'dono').map(u => u.id));
    await sendTo(subs.filter(s => donoIds.has(s.usuario_id)), payload);
  } catch (e) { console.error('[push donos]', e); }
}
