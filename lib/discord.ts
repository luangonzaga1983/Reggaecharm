import type {
  Usuario, Agendamento, BarbeiroDB, StoreConfig,
  MaintenanceConfig, FotoBarbeiro, UnidadeConfig, ServicoConfig,
  PixTransaction, PixStatus, ReservaFila, PushSub,
} from '@/types';

// ─── Env (lazy + strict) ──────────────────────────────────────────────────────

function envOrThrow(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} not set`);
  return v;
}

const TOKEN   = () => envOrThrow('DISCORD_TOKEN');
const CH_USR  = () => envOrThrow('DISCORD_CHANNEL_USUARIOS');
const CH_AGD  = () => envOrThrow('DISCORD_CHANNEL_AGENDAMENTOS');
const CH_BAR  = () => envOrThrow('DISCORD_CHANNEL_BARBEIROS');
const CH_CFG  = () => envOrThrow('DISCORD_CHANNEL_CONFIG');
const CH_MAINT = () => process.env.DISCORD_CHANNEL_MANUTENCAO || CH_CFG();
const CH_FOTO = () => process.env.DISCORD_CHANNEL_FOTOS_BARBEIROS || CH_BAR();
const CH_PIX  = () => process.env.DISCORD_CHANNEL_PIX || CH_CFG();
// Fila de reserva: reusa o canal de agendamentos por padrão (sem env nova).
const CH_FILA = () => process.env.DISCORD_CHANNEL_FILA || CH_AGD();
// Inscrições de push: canal próprio recomendado; cai no de config se não setado.
const CH_PUSH = () => process.env.DISCORD_CHANNEL_PUSH || CH_CFG();

const BASE = 'https://discord.com/api/v10';
const DISCORD_MSG_LIMIT = 1900;

// ─── Discord primitives ───────────────────────────────────────────────────────

interface DAttachment { url: string; filename?: string; }
interface DMsg { id: string; content: string; attachments?: DAttachment[]; }

function headers(token: string) {
  return { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * fetch resiliente para a API do Discord:
 * - 429 (rate limit): respeita `Retry-After` / `retry_after` do corpo e tenta de novo.
 * - 5xx / falha de rede: backoff exponencial.
 * Nunca devolve dado parcial — o chamador trata `!res.ok` como erro fatal.
 */
async function discordFetch(url: string, init: RequestInit, retries = 5): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, cache: 'no-store' });
    } catch (e) {
      if (attempt >= retries) throw e;
      await sleep(Math.min(1000 * 2 ** attempt, 8000));
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      let waitMs = 1000 * 2 ** attempt;
      const ra = res.headers.get('retry-after');
      if (ra) waitMs = Math.max(waitMs, Math.ceil(parseFloat(ra) * 1000));
      if (res.status === 429) {
        try { const b: any = await res.clone().json(); if (b?.retry_after) waitMs = Math.ceil(b.retry_after * 1000); } catch { /* corpo não-JSON */ }
      }
      await sleep(Math.min(waitMs, 10_000));
      continue;
    }
    return res;
  }
}

// Cache curto por canal: colapsa varreduras repetidas no mesmo request e poupa
// orçamento de rate limit. Escritas invalidam o canal na hora.
const _chCache = new Map<string, { msgs: DMsg[]; time: number }>();
const CH_TTL = 5_000;
function invalidate(channelId: string) { _chCache.delete(channelId); }

async function fetchAll(channelId: string, opts: { fresh?: boolean } = {}): Promise<DMsg[]> {
  const now = Date.now();
  if (!opts.fresh) {
    const c = _chCache.get(channelId);
    if (c && now - c.time < CH_TTL) return c.msgs;
  }
  const token = TOKEN();
  const all: DMsg[] = [];
  let before: string | undefined;
  while (true) {
    const url = new URL(`${BASE}/channels/${channelId}/messages`);
    url.searchParams.set('limit', '100');
    if (before) url.searchParams.set('before', before);
    const res = await discordFetch(url.toString(), { headers: headers(token) });
    if (!res.ok) throw new Error(`Discord fetch ${channelId} falhou: ${res.status}`);
    const batch: DMsg[] = await res.json();
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < 100) break;
    before = batch[batch.length - 1].id;
  }
  _chCache.set(channelId, { msgs: all, time: now });
  return all;
}

async function post(channelId: string, content: string): Promise<DMsg> {
  if (content.length > 2000) throw new Error('Content exceeds Discord limit');
  const res = await discordFetch(`${BASE}/channels/${channelId}/messages`, {
    method: 'POST', headers: headers(TOKEN()), body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Discord post failed: ${res.status}`);
  invalidate(channelId);
  return res.json();
}

async function edit(channelId: string, msgId: string, content: string): Promise<void> {
  if (content.length > 2000) throw new Error('Content exceeds Discord limit');
  const res = await discordFetch(`${BASE}/channels/${channelId}/messages/${msgId}`, {
    method: 'PATCH', headers: headers(TOKEN()), body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Discord edit failed: ${res.status}`);
  invalidate(channelId);
}

async function del(channelId: string, msgId: string): Promise<void> {
  const res = await discordFetch(`${BASE}/channels/${channelId}/messages/${msgId}`, {
    method: 'DELETE', headers: { Authorization: `Bot ${TOKEN()}` },
  });
  // 404 = já não existe (idempotente, ok). Qualquer outro erro PROPAGA — antes
  // era engolido, o que mascarava deletes que falhavam (causa de duplicatas).
  if (!res.ok && res.status !== 404) throw new Error(`Discord delete failed: ${res.status}`);
  invalidate(channelId);
}

function safeFilename(name: string): string {
  return name.replace(/[^\w.\-]/g, '_').slice(0, 80) || 'file';
}

async function uploadFile(
  channelId: string,
  content: string,
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
): Promise<DMsg> {
  if (content.length > 2000) throw new Error('Caption exceeds Discord limit');
  const fd = new FormData();
  fd.append('content', content);
  fd.append('files[0]', new Blob([buffer], { type: mimeType }), safeFilename(filename));
  const res = await discordFetch(`${BASE}/channels/${channelId}/messages`, {
    method: 'POST', headers: { Authorization: `Bot ${TOKEN()}` }, body: fd,
  });
  if (!res.ok) throw new Error(`Discord upload failed: ${res.status}`);
  invalidate(channelId);
  return res.json();
}

// ─── Store Config (stored as JSON attachment to bypass 2000-char limit) ───────

const DEFAULT_CONFIG: Omit<StoreConfig, '_messageId'> = {
  nome_loja: 'Reggae Charm',
  slogan: 'One Love, One Cut',
  tema_cor: 'green',
  unidades: [
    { id:'u1', nome:'Reggae Charm Centro',   endereco:'Rua das Palmeiras, 142', bairro:'Centro',        cidade:'São Bernardo do Campo', horario:{abertura:8,fechamento:20}, dias_semana:[1,2,3,4,5,6], barbeiros:['b1','b2'], ativo:true },
    { id:'u2', nome:'Reggae Charm Paulista', endereco:'Av. Paulista, 1023',     bairro:'Bela Vista',    cidade:'São Paulo',             horario:{abertura:9,fechamento:21}, dias_semana:[1,2,3,4,5,6], barbeiros:['b3','b4'], ativo:true },
    { id:'u3', nome:'Reggae Charm ABC',      endereco:'Rua Goiás, 88',          bairro:'Nova Petrópolis',cidade:'São Bernardo do Campo', horario:{abertura:8,fechamento:19}, dias_semana:[1,2,3,4,5],   barbeiros:['b1','b3'], ativo:true },
    { id:'u4', nome:'Reggae Charm Sul',      endereco:'Av. Miguel Yunes, 500',  bairro:'Rudge Ramos',   cidade:'São Bernardo do Campo', horario:{abertura:9,fechamento:20}, dias_semana:[1,2,3,4,5,6], barbeiros:['b2','b4'], ativo:true },
  ] as UnidadeConfig[],
  servicos: [
    { id:'s01', nome:'Corte Degradê',              valor:35,  duracao:60, descricao:'Cabelo',    ativo:true },
    { id:'s02', nome:'Só Raspar',                  valor:15,  duracao:20, descricao:'Cabelo',    ativo:true },
    { id:'s03', nome:'Pézinho',                    valor:10,  duracao:10, descricao:'Cabelo',    ativo:true },
    { id:'s04', nome:'Corte na Tesoura',           valor:30,  duracao:30, descricao:'Cabelo',    ativo:true },
    { id:'s05', nome:'Corte Social',               valor:25,  duracao:30, descricao:'Cabelo',    ativo:true },
    { id:'s06', nome:'Bigode e Cavanhaque',        valor:15,  duracao:10, descricao:'Barba',     ativo:true },
    { id:'s07', nome:'Barboterapia',               valor:25,  duracao:30, descricao:'Barba',     ativo:true },
    { id:'s08', nome:'Corte e Barboterapia',       valor:60,  duracao:90, descricao:'Combo',     ativo:true },
    { id:'s09', nome:'Corte, Bigode e Cavanhaque', valor:50,  duracao:60, descricao:'Combo',     ativo:true },
    { id:'s10', nome:'Corte e Sobrancelha',        valor:40,  duracao:60, descricao:'Combo',     ativo:true },
    { id:'s11', nome:'Corte e Progressiva',        valor:90,  duracao:90, descricao:'Combo',     ativo:true },
    { id:'s12', nome:'Corte e Platinado',          valor:130, duracao:90, descricao:'Combo',     ativo:true },
    { id:'s13', nome:'Corte e Pigmentacao',        valor:60,  duracao:90, descricao:'Combo',     ativo:true },
    { id:'s14', nome:'Corte e Luzes',              valor:90,  duracao:90, descricao:'Combo',     ativo:true },
    { id:'s15', nome:'Corte e Limpeza de Pele',    valor:65,  duracao:90, descricao:'Combo',     ativo:true },
    { id:'s16', nome:'Corte e Alisamento',         valor:55,  duracao:60, descricao:'Combo',     ativo:true },
    { id:'s17', nome:'Corte e Botox',              valor:90,  duracao:90, descricao:'Combo',     ativo:true },
    { id:'s18', nome:'Sobrancelha',                valor:10,  duracao:10, descricao:'Adicional', ativo:true },
    { id:'s19', nome:'Limpeza de Pele',            valor:30,  duracao:30, descricao:'Adicional', ativo:true },
    { id:'s20', nome:'Botox / Progressiva',        valor:70,  duracao:30, descricao:'Quimica',   ativo:true },
    { id:'s21', nome:'Alisamento',                 valor:20,  duracao:20, descricao:'Quimica',   ativo:true },
    { id:'s22', nome:'Pigmentacao',                valor:25,  duracao:30, descricao:'Quimica',   ativo:true },
    { id:'s23', nome:'Platinado',                  valor:100, duracao:30, descricao:'Quimica',   ativo:true },
    { id:'s24', nome:'Luzes',                      valor:70,  duracao:30, descricao:'Quimica',   ativo:true },
  ] as ServicoConfig[],
};

const CFG_MARKER = '__type:store_config_v2';
const CFG_FILENAME = 'store_config.json';
const MAINT_MARKER = '__type:maintenance_config_v2';
const MAINT_FILENAME = 'maintenance.json';

let _cfgCache: StoreConfig | null = null;
let _cfgTime = 0;
const CFG_TTL = 20_000;

async function readAttachmentJson<T>(att: DAttachment): Promise<T | null> {
  try {
    const r = await fetch(att.url, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json() as T;
  } catch { return null; }
}

export async function getStoreConfig(): Promise<StoreConfig> {
  const now = Date.now();
  if (_cfgCache && now - _cfgTime < CFG_TTL) return _cfgCache;
  try {
    const msgs = await fetchAll(CH_CFG());
    for (const m of msgs) {
      // New format: attachment-based
      if (m.content.startsWith(CFG_MARKER) && m.attachments?.length) {
        const data = await readAttachmentJson<Omit<StoreConfig, '_messageId'>>(m.attachments[0]);
        if (data) {
          _cfgCache = { ...data, _messageId: m.id };
          _cfgTime = now;
          return _cfgCache!;
        }
      }
      // Legacy format: inline JSON (migrate on next save)
      try {
        const d = JSON.parse(m.content);
        if (d.__type === 'store_config') {
          _cfgCache = { ...d, _messageId: m.id };
          _cfgTime = now;
          return _cfgCache!;
        }
      } catch { /* skip */ }
    }
  } catch { /* fallback */ }
  return { ...DEFAULT_CONFIG };
}

export async function saveStoreConfig(config: StoreConfig): Promise<StoreConfig> {
  const { _messageId, ...data } = config;
  const json = JSON.stringify(data);
  const buf  = new TextEncoder().encode(json).buffer as ArrayBuffer;

  // Always store as attachment to avoid 2000-char message limit
  const ch = CH_CFG();
  if (_messageId) await del(ch, _messageId);
  const msg = await uploadFile(ch, CFG_MARKER, buf, CFG_FILENAME, 'application/json');

  _cfgCache = { ...data, _messageId: msg.id } as StoreConfig;
  _cfgTime = Date.now();
  return _cfgCache!;
}

export function invalidateConfigCache(): void {
  _cfgCache = null;
  _cfgTime = 0;
}

// ─── Usuários ─────────────────────────────────────────────────────────────────

function parseUser(m: DMsg): Usuario | null {
  try {
    const d = JSON.parse(m.content);
    if (d.__type) return null;
    return { ...d, foto_url: m.attachments?.[0]?.url ?? null, _messageId: m.id };
  } catch { return null; }
}

export async function getAllUsuarios(): Promise<Usuario[]> {
  return (await fetchAll(CH_USR())).map(parseUser).filter(Boolean) as Usuario[];
}
export const getUsuarioByEmail    = async (email: string)    => (await getAllUsuarios()).find(u => u.email === email.toLowerCase()) ?? null;
export const getUsuarioByUsername = async (username: string) => (await getAllUsuarios()).find(u => u.username?.toLowerCase() === username.toLowerCase()) ?? null;
export const getUsuarioById       = async (id: string)       => (await getAllUsuarios()).find(u => u.id === id) ?? null;

export async function createUsuario(u: Omit<Usuario, '_messageId'>): Promise<Usuario> {
  const json = JSON.stringify(u);
  if (json.length > DISCORD_MSG_LIMIT) throw new Error('Usuário excede limite de tamanho');
  const msg = await post(CH_USR(), json);
  return { ...u, _messageId: msg.id };
}

export async function updateUsuario(u: Usuario): Promise<void> {
  if (!u._messageId) throw new Error('Missing _messageId');
  const { _messageId, foto_url, ...data } = u;
  const json = JSON.stringify(data);
  if (json.length > DISCORD_MSG_LIMIT) throw new Error('Usuário excede limite de tamanho');
  await edit(CH_USR(), _messageId, json);
}

export async function uploadUserPhoto(u: Usuario, buffer: ArrayBuffer, filename: string, mime: string): Promise<string> {
  if (u._messageId) await del(CH_USR(), u._messageId);
  const { _messageId, foto_url, ...data } = u;
  const msg = await uploadFile(CH_USR(), JSON.stringify(data), buffer, filename, mime);
  return msg.attachments?.[0]?.url ?? '';
}

export async function deleteUsuario(msgId: string): Promise<void> {
  await del(CH_USR(), msgId);
}

export async function banirUsuario(u: Usuario, motivo: string, ip?: string): Promise<void> {
  u.banido = true;
  u.ban_motivo = motivo;
  if (ip) u.ban_ip = ip;
  u.role = 'cliente';
  u.token_version = (u.token_version ?? 0) + 1; // revoga sessões ativas do banido
  await updateUsuario(u);
}

export async function desbanirUsuario(u: Usuario): Promise<void> {
  u.banido = false;
  u.ban_motivo = null;
  u.ban_ip = null;
  await updateUsuario(u);
}

// ─── Agendamentos ─────────────────────────────────────────────────────────────

function parseAg(m: DMsg): Agendamento | null {
  try {
    const d = JSON.parse(m.content);
    if (d.__type) return null;
    return { ...d, _messageId: m.id };
  } catch { return null; }
}

export async function getAllAgendamentos(opts: { fresh?: boolean } = {}): Promise<Agendamento[]> {
  return (await fetchAll(CH_AGD(), opts)).map(parseAg).filter(Boolean) as Agendamento[];
}

export const getAgendamentoById       = async (id: string)       => (await getAllAgendamentos()).find(a => a.id === id) ?? null;
export const getAgendamentosByUsuario = async (id: string)       => (await getAllAgendamentos()).filter(a => a.usuario_id === id);
export const getAgendamentosByBarbeiro = async (id: string)      => (await getAllAgendamentos()).filter(a => a.barbeiro_id === id);
export const getAgendamentosByUnidade = async (id: string)       => (await getAllAgendamentos()).filter(a => a.unidade_id === id);

/** Minutos que um PIX não pago segura o horário antes de liberar (anti-fantasma). */
export const HOLD_PIX_MIN = 15;

/**
 * Um agendamento segura o slot se: já pago, OU não é PIX (dinheiro/crédito),
 * OU é PIX recém-criado (dentro da janela de HOLD_PIX_MIN). PIX não pago e
 * vencido NÃO bloqueia mais — evita agenda travada por quem nunca pagou.
 */
export function seguraSlot(a: Agendamento): boolean {
  if (a.pago) return true;
  if (a.pagamento_metodo !== 'pix') return true;
  if (!a.criado_em) return true; // legado sem timestamp: mantém comportamento antigo
  return Date.now() - new Date(a.criado_em).getTime() < HOLD_PIX_MIN * 60_000;
}

export async function getHorariosOcupados(barbeiroId: string, data: string): Promise<string[]> {
  // fresh: leitura crítica para evitar marcar horário já ocupado.
  const all = await getAllAgendamentos({ fresh: true });
  return all
    .filter(a => a.barbeiro_id === barbeiroId && a.data === data && a.status !== 'cancelado' && seguraSlot(a))
    .map(a => a.horario);
}

export async function getMediaEstrelas(barbeiroId: string): Promise<{ media: number; total: number }> {
  const ags = await getAgendamentosByBarbeiro(barbeiroId);
  const valid = ags.filter(a => a.avaliacao !== null && a.avaliacao > 0);
  if (!valid.length) return { media: 0, total: 0 };
  const sum = valid.reduce((s, a) => s + (a.avaliacao ?? 0), 0);
  return { media: Math.round((sum / valid.length) * 10) / 10, total: valid.length };
}

export async function createAgendamento(ag: Omit<Agendamento, '_messageId'>): Promise<Agendamento> {
  const msg = await post(CH_AGD(), JSON.stringify(ag));
  return { ...ag, _messageId: msg.id };
}

export async function updateAgendamento(ag: Agendamento): Promise<void> {
  if (!ag._messageId) throw new Error('Missing _messageId');
  const { _messageId, ...data } = ag;
  await edit(CH_AGD(), _messageId, JSON.stringify(data));
}

// ─── Reservas de fila ─────────────────────────────────────────────────────────
// Guardadas no mesmo canal de agendamentos, com marcador __type. parseAg ignora
// mensagens com __type, então as duas coleções coexistem sem conflito.

function parseReserva(m: DMsg): ReservaFila | null {
  try {
    const d = JSON.parse(m.content);
    if (d.__type !== 'reserva_fila') return null;
    const { __type, ...rest } = d;
    return { ...rest, _messageId: m.id };
  } catch { return null; }
}

export async function getAllReservas(): Promise<ReservaFila[]> {
  return (await fetchAll(CH_FILA())).map(parseReserva).filter(Boolean) as ReservaFila[];
}
export const getReservaBySlot = async (barbeiroId: string, data: string, horario: string) =>
  (await getAllReservas()).find(r => r.barbeiro_id === barbeiroId && r.data === data && r.horario === horario) ?? null;
export const getReservasByUsuario = async (id: string) =>
  (await getAllReservas()).filter(r => r.usuario_id === id);

export async function createReserva(r: Omit<ReservaFila, '_messageId'>): Promise<ReservaFila> {
  const msg = await post(CH_FILA(), JSON.stringify({ __type: 'reserva_fila', ...r }));
  return { ...r, _messageId: msg.id };
}
export async function deleteReserva(msgId: string): Promise<void> {
  await del(CH_FILA(), msgId);
}

// ─── Push subscriptions ───────────────────────────────────────────────────────

function parsePushSub(m: DMsg): PushSub | null {
  try {
    const d = JSON.parse(m.content);
    if (d.__type !== 'push_sub') return null;
    const { __type, ...rest } = d;
    return { ...rest, _messageId: m.id };
  } catch { return null; }
}

export async function getAllPushSubs(): Promise<PushSub[]> {
  return (await fetchAll(CH_PUSH())).map(parsePushSub).filter(Boolean) as PushSub[];
}
export const getPushSubsByUsuario = async (id: string) =>
  (await getAllPushSubs()).filter(s => s.usuario_id === id);

export async function savePushSub(sub: Omit<PushSub, '_messageId'>): Promise<PushSub> {
  const all = await getAllPushSubs();
  const existing = all.find(s => s.endpoint === sub.endpoint);
  if (existing) return existing; // já inscrito neste navegador
  const msg = await post(CH_PUSH(), JSON.stringify({ __type: 'push_sub', ...sub }));
  return { ...sub, _messageId: msg.id };
}
export async function deletePushSub(msgId: string): Promise<void> {
  await del(CH_PUSH(), msgId);
}
export async function deletePushSubByEndpoint(endpoint: string): Promise<void> {
  const s = (await getAllPushSubs()).find(x => x.endpoint === endpoint);
  if (s?._messageId) await del(CH_PUSH(), s._messageId);
}

// ─── Barbeiros ────────────────────────────────────────────────────────────────

function parseBar(m: DMsg): BarbeiroDB | null {
  try {
    const d = JSON.parse(m.content);
    if (d.__type) return null;
    return { ...d, photo_url: m.attachments?.[0]?.url ?? null, _messageId: m.id };
  } catch { return null; }
}

export async function getAllBarbeiros(): Promise<BarbeiroDB[]> {
  return (await fetchAll(CH_BAR())).map(parseBar).filter(Boolean) as BarbeiroDB[];
}
export const getBarbeiroById = async (id: string) => (await getAllBarbeiros()).find(b => b.id === id) ?? null;

export async function createBarbeiro(b: Omit<BarbeiroDB, '_messageId' | 'photo_url'>): Promise<BarbeiroDB> {
  const msg = await post(CH_BAR(), JSON.stringify({ ...b, photo_message_id: null }));
  return { ...b, photo_url: null, _messageId: msg.id };
}

export async function updateBarbeiro(b: BarbeiroDB): Promise<void> {
  if (!b._messageId) throw new Error('Missing _messageId');
  const { _messageId, photo_url, ...data } = b;
  await edit(CH_BAR(), _messageId, JSON.stringify(data));
}

export async function uploadBarberPhoto(b: BarbeiroDB, buffer: ArrayBuffer, filename: string, mime: string): Promise<string> {
  if (b._messageId) await del(CH_BAR(), b._messageId);
  const { _messageId, photo_url, ...data } = b;
  const msg = await uploadFile(CH_BAR(), JSON.stringify({ ...data, photo_message_id: null }), buffer, filename, mime);
  return msg.attachments?.[0]?.url ?? '';
}

/**
 * Exclusão permanente do barbeiro. Apaga TODAS as mensagens com esse id (não só
 * uma) — limpa eventuais duplicatas que tenham surgido. Retorna quantas removeu.
 */
export async function deleteBarbeiro(id: string): Promise<number> {
  const msgs = await fetchAll(CH_BAR(), { fresh: true });
  let n = 0;
  for (const m of msgs) {
    const b = parseBar(m);
    if (b && b.id === id && m.id) { await del(CH_BAR(), m.id); n++; }
  }
  return n;
}

// ─── Manutenção (também via anexo) ────────────────────────────────────────────

export async function getMaintenanceConfig(): Promise<MaintenanceConfig> {
  try {
    const msgs = await fetchAll(CH_MAINT());
    for (const m of msgs) {
      if (m.content.startsWith(MAINT_MARKER) && m.attachments?.length) {
        const data = await readAttachmentJson<Omit<MaintenanceConfig, '_messageId'>>(m.attachments[0]);
        if (data) return { ...data, _messageId: m.id };
      }
      try {
        const d = JSON.parse(m.content);
        if (d.__type === 'maintenance_config') return { ...d, _messageId: m.id };
      } catch { /* skip */ }
    }
  } catch { /* fallback */ }
  return { ativo: false, mensagem: 'Site em manutenção. Voltamos em breve.' };
}

export async function saveMaintenanceConfig(cfg: MaintenanceConfig): Promise<MaintenanceConfig> {
  const { _messageId, ...data } = cfg;
  const json = JSON.stringify(data);
  const buf  = new TextEncoder().encode(json).buffer as ArrayBuffer;
  const ch = CH_MAINT();
  if (_messageId) await del(ch, _messageId);
  const msg = await uploadFile(ch, MAINT_MARKER, buf, MAINT_FILENAME, 'application/json');
  return { ...data, _messageId: msg.id };
}

// ─── Fotos de barbeiro ────────────────────────────────────────────────────────

function parseFoto(m: DMsg): FotoBarbeiro | null {
  try {
    const d = JSON.parse(m.content);
    if (d.__type !== 'foto_barbeiro') return null;
    const { __type, ...rest } = d;
    return { ...rest, foto_url: m.attachments?.[0]?.url ?? null, _messageId: m.id };
  } catch { return null; }
}

export async function getFotosByBarbeiro(barbeiroId: string): Promise<FotoBarbeiro[]> {
  const msgs = await fetchAll(CH_FOTO());
  return msgs.map(parseFoto).filter((f): f is FotoBarbeiro => f !== null && f.barbeiro_id === barbeiroId);
}

export async function createFotoBarbeiro(
  barbeiroId: string, descricao: string,
  buffer: ArrayBuffer, filename: string, mime: string,
): Promise<FotoBarbeiro> {
  const id   = `f${Date.now()}`;
  const data = new Date().toLocaleDateString('pt-BR');
  const meta = JSON.stringify({ __type: 'foto_barbeiro', id, barbeiro_id: barbeiroId, descricao, data });
  const msg  = await uploadFile(CH_FOTO(), meta, buffer, filename, mime);
  return { id, barbeiro_id: barbeiroId, descricao, data, foto_url: msg.attachments?.[0]?.url ?? null, _messageId: msg.id };
}

export async function deleteFotoBarbeiro(msgId: string): Promise<void> {
  await del(CH_FOTO(), msgId);
}

// ─── PIX Transactions ─────────────────────────────────────────────────────────

const PIX_MARKER = '__type:pix_tx_v1';
const PIX_FILENAME = 'pix_tx.json';

function parsePixTx(m: DMsg): PixTransaction | null {
  if (!m.content.startsWith(PIX_MARKER)) return null;
  if (!m.attachments?.length) {
    // inline JSON fallback
    try {
      const idx = m.content.indexOf('{');
      if (idx < 0) return null;
      const d = JSON.parse(m.content.slice(idx));
      return { ...d, _messageId: m.id };
    } catch { return null; }
  }
  return null; // marcador padrão: dados completos em attachment
}

export async function createPixTransaction(tx: Omit<PixTransaction, '_messageId'>): Promise<PixTransaction> {
  const json = JSON.stringify(tx);
  const buf = new TextEncoder().encode(json).buffer as ArrayBuffer;
  const msg = await uploadFile(CH_PIX(), PIX_MARKER, buf, PIX_FILENAME, 'application/json');
  return { ...tx, _messageId: msg.id };
}

async function loadAllPixTxs(): Promise<PixTransaction[]> {
  const msgs = await fetchAll(CH_PIX());
  const out: PixTransaction[] = [];
  for (const m of msgs) {
    if (!m.content.startsWith(PIX_MARKER)) continue;
    if (!m.attachments?.length) {
      const inline = parsePixTx(m);
      if (inline) out.push(inline);
      continue;
    }
    const data = await readAttachmentJson<Omit<PixTransaction, '_messageId'>>(m.attachments[0]);
    if (data) out.push({ ...data, _messageId: m.id });
  }
  return out;
}

export async function getPixTxById(transactionId: string): Promise<PixTransaction | null> {
  const all = await loadAllPixTxs();
  return all.find(t => t.id === transactionId) ?? null;
}

export async function getPixTxsByUsuario(usuarioId: string): Promise<PixTransaction[]> {
  const all = await loadAllPixTxs();
  return all.filter(t => t.usuario_id === usuarioId);
}

export async function updatePixTransaction(tx: PixTransaction): Promise<void> {
  if (!tx._messageId) throw new Error('Missing _messageId');
  const { _messageId, ...data } = tx;
  const json = JSON.stringify(data);
  const buf = new TextEncoder().encode(json).buffer as ArrayBuffer;
  await del(CH_PIX(), _messageId);
  const msg = await uploadFile(CH_PIX(), PIX_MARKER, buf, PIX_FILENAME, 'application/json');
  tx._messageId = msg.id;
}
