/**
 * Lockout de login com backoff exponencial — defesa contra brute-force/credential-stuffing.
 *
 * Por que por CONTA (e não só por IP): atacante sério rotaciona IPs (botnet/proxies),
 * então rate-limit por IP no middleware não basta. Aqui travamos a tentativa contra a
 * própria identidade alvo. Combinado com o rate-limit de IP do middleware = duas barreiras.
 *
 * In-memory por instância (mesma estratégia do rate-limit do middleware). Serverless pode
 * ter várias instâncias, mas cada uma converge para o mesmo bloqueio — defesa em profundidade,
 * não verdade global. Para barbearia (volume baixo) é mais que suficiente.
 *
 * Backoff: 0-4 falhas → livre. 5ª falha em diante → bloqueio = min(2^(n-4) s, 15min).
 * Falhas contam dentro de uma janela de 15min; sucesso zera tudo.
 */

type Rec = { fails: number; lockedUntil: number; first: number };
const store = new Map<string, Rec>();

const WINDOW_MS   = 15 * 60 * 1000;
const FREE_TRIES  = 4;
const MAX_LOCK_MS = 15 * 60 * 1000;
const MAX_KEYS    = 20_000;

function sweep(now: number) {
  if (store.size <= MAX_KEYS) return;
  store.forEach((r, k) => {
    if (now > r.lockedUntil && now - r.first > WINDOW_MS) store.delete(k);
  });
  if (store.size > MAX_KEYS) store.clear();
}

/** Retorna ms restantes de bloqueio, ou 0 se liberado. */
export function lockRemaining(key: string): number {
  const r = store.get(key);
  if (!r) return 0;
  const now = Date.now();
  if (now < r.lockedUntil) return r.lockedUntil - now;
  return 0;
}

/** Registra uma falha de login. Retorna ms de bloqueio aplicado (0 se ainda livre). */
export function registerFail(key: string): number {
  const now = Date.now();
  sweep(now);
  let r = store.get(key);
  if (!r || now - r.first > WINDOW_MS) {
    r = { fails: 0, lockedUntil: 0, first: now };
  }
  r.fails++;
  if (r.fails > FREE_TRIES) {
    const lockMs = Math.min(2 ** (r.fails - FREE_TRIES) * 1000, MAX_LOCK_MS);
    r.lockedUntil = now + lockMs;
    store.set(key, r);
    return lockMs;
  }
  store.set(key, r);
  return 0;
}

/** Login bem-sucedido: limpa o histórico de falhas da conta. */
export function clearFails(key: string): void {
  store.delete(key);
}
