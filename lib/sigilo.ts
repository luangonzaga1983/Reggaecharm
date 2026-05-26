/**
 * sigilo.ts — Client SigiloPay (server-side ONLY).
 * Chaves NUNCA saem do servidor.
 */
import type { PixStatus } from '@/types';

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} not set`);
  return v;
}

const BASE = () => env('SIGILO_BASE');
const PUB  = () => env('SIGILO_PUB');
const PRIV = () => env('SIGILO_PRIV');

async function sigiloPost<T>(endpoint: string, body: unknown): Promise<T> {
  const r = await fetch(BASE() + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-public-key': PUB(),
      'x-secret-key': PRIV(),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`SigiloPay ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json() as Promise<T>;
}

async function sigiloGet<T>(endpoint: string): Promise<T> {
  const r = await fetch(BASE() + endpoint, {
    headers: { 'x-public-key': PUB(), 'x-secret-key': PRIV() },
    cache: 'no-store',
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`SigiloPay ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json() as Promise<T>;
}

export interface PixGenerateResponse {
  transactionId: string;
  identifier: string;
  qrCodeBase64: string;
  qrCodeText: string;
  amount: number;
  status: PixStatus;
  expiresAt: string;
}

export interface PixStatusResponse {
  transactionId: string;
  status: PixStatus;
  paidAt?: string;
  amount: number;
}

// Cliente anônimo — agendamento de barbearia não precisa expor PII no gateway
const ANON_CLIENT = {
  name:     'Cliente Reggae Charm',
  email:    'cliente@reggaecharm.com',
  phone:    '(11) 99999-9999',
  document: '52998224725',
};

export async function generatePix(opts: {
  amount: number;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<PixGenerateResponse> {
  if (opts.amount < 1) throw new Error('Valor mínimo R$ 1,00');
  if (opts.amount > 10000) throw new Error('Valor máximo R$ 10.000,00');

  const identifier = `rc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const dueDate = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];

  const raw = await sigiloPost<{
    transactionId: string;
    status: PixStatus;
    pix: { code: string; base64: string };
  }>('/gateway/pix/receive', {
    identifier,
    amount: opts.amount,
    client: ANON_CLIENT,
    products: [{
      id: 'rc_servico',
      name: opts.description.slice(0, 120),
      quantity: 1,
      price: opts.amount,
    }],
    metadata: { gateway: 'reggae-charm', ...opts.metadata },
  });

  return {
    transactionId: raw.transactionId,
    identifier,
    qrCodeBase64: raw.pix.base64,
    qrCodeText:   raw.pix.code,
    amount: opts.amount,
    status: raw.status,
    expiresAt: dueDate,
  };
}

export async function getPixStatus(transactionId: string): Promise<PixStatusResponse> {
  return sigiloGet<PixStatusResponse>(`/gateway/pix/${transactionId}`);
}
