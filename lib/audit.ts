import type { Session, Usuario } from '@/types';

type AuditAction =
  | 'login' | 'logout' | 'register'
  | 'ban' | 'unban' | 'promote' | 'demote'
  | 'delete_user' | 'delete_appointment'
  | 'config_change' | 'maintenance_toggle'
  | 'photo_upload' | 'photo_delete'
  | 'admin_access_denied';

export interface AuditEntry {
  ts: string;
  actor_id: string | null;
  actor_role: string | null;
  action: AuditAction;
  target_id?: string;
  target_label?: string;
  ip?: string;
  ua?: string;
  meta?: Record<string, unknown>;
}

/**
 * Audit log — emits structured JSON to stdout. In production, a log shipper
 * (e.g. Datadog, Loki) should ingest this. Never logs secrets/passwords.
 */
export function audit(entry: AuditEntry): void {
  const safe: AuditEntry = {
    ts: new Date().toISOString(),
    actor_id: entry.actor_id,
    actor_role: entry.actor_role,
    action: entry.action,
    ...(entry.target_id ? { target_id: entry.target_id } : {}),
    ...(entry.target_label ? { target_label: entry.target_label } : {}),
    ...(entry.ip ? { ip: entry.ip } : {}),
    ...(entry.ua ? { ua: entry.ua.slice(0, 200) } : {}),
    ...(entry.meta ? { meta: entry.meta } : {}),
  };
  // eslint-disable-next-line no-console
  console.log(`[AUDIT] ${JSON.stringify(safe)}`);
}

export function auditFromSession(
  session: Session | null,
  action: AuditAction,
  extra: Omit<AuditEntry, 'ts' | 'actor_id' | 'actor_role' | 'action'> = {},
): void {
  audit({
    ts: '', // overwritten in audit()
    actor_id: session?.id ?? null,
    actor_role: session?.role ?? null,
    action,
    ...extra,
  });
}

/**
 * Remove campos sensíveis do objeto Usuario antes de retornar via API.
 * - `senha` (hash bcrypt) NUNCA deve sair
 * - `ban_ip` apenas para gerenciamento interno
 * - `device_hash` é PII; só dono pode ver o próprio
 */
export function sanitizeUserOut<T extends Partial<Usuario>>(
  u: T,
  opts: { isSelf?: boolean; isAdmin?: boolean } = {},
): Omit<T, 'senha' | 'ban_ip' | 'device_hash'> & { device_hash?: string | null } {
  const { senha: _s, ban_ip: _bi, device_hash, ...rest } = u as any;
  const out: any = rest;
  if (opts.isSelf || opts.isAdmin) {
    // dono/admin/o próprio usuário podem ver device_hash; outros não
    out.device_hash = device_hash ?? null;
  }
  return out;
}
