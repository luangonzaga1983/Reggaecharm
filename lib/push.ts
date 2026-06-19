/**
 * Sistema de notificações (Web Push) REMOVIDO.
 * Push em navegador exige VAPID + renovação de chaves e não era confiável, então
 * foi desativado. Estas funções viraram no-ops para os chamadores existentes
 * (cron, pix, agendamentos) continuarem compilando sem enviar nada.
 */
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
}

export function pushEnabled(): boolean { return false; }
export function pushPublicKey(): string | null { return null; }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function pushToUsuario(_usuarioId: string, _payload: PushPayload): Promise<void> { /* desativado */ }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function pushToDonos(_payload: PushPayload): Promise<void> { /* desativado */ }
