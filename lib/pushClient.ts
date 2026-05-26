'use client';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function pushAtivo(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return !!sub;
  } catch { return false; }
}

export async function ativarPush(): Promise<{ ok: boolean; msg: string }> {
  if (!pushSupported()) return { ok: false, msg: 'Seu navegador não suporta notificações.' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, msg: 'Permissão de notificação negada.' };

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const keyRes = await fetch('/api/push?action=key');
  const { key } = await keyRes.json();
  if (!key) return { ok: false, msg: 'Notificações ainda não configuradas no servidor.' };

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  });
  const res = await fetch('/api/push', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'subscribe', subscription: sub.toJSON() }),
  });
  if (!res.ok) return { ok: false, msg: 'Falha ao registrar no servidor.' };
  return { ok: true, msg: 'Notificações ativadas!' };
}

export async function desativarPush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch('/api/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}
