import type {
  Usuario, Agendamento, BarbeiroDB, StoreConfig,
  MaintenanceConfig, FotoBarbeiro, UnidadeConfig, ServicoConfig,
} from '@/types';

// ─── Env ──────────────────────────────────────────────────────────────────────

const TOKEN   = () => { const t = process.env.DISCORD_TOKEN;               if (!t) throw new Error('DISCORD_TOKEN not set');               return t; };
const CH_USR  = () => { const t = process.env.DISCORD_CHANNEL_USUARIOS;    if (!t) throw new Error('DISCORD_CHANNEL_USUARIOS not set');    return t; };
const CH_AGD  = () => { const t = process.env.DISCORD_CHANNEL_AGENDAMENTOS; if (!t) throw new Error('DISCORD_CHANNEL_AGENDAMENTOS not set'); return t; };
const CH_BAR  = () => { const t = process.env.DISCORD_CHANNEL_BARBEIROS;   if (!t) throw new Error('DISCORD_CHANNEL_BARBEIROS not set');   return t; };
const CH_CFG  = () => { const t = process.env.DISCORD_CHANNEL_CONFIG || process.env.DISCORD_CHANNEL_USUARIOS; if (!t) throw new Error('DISCORD_CHANNEL_CONFIG not set'); return t; };
const CH_FOTO = () => process.env.DISCORD_CHANNEL_FOTOS_BARBEIROS || CH_BAR();

const BASE = 'https://discord.com/api/v10';

// ─── Discord primitives ───────────────────────────────────────────────────────

interface DMsg { id: string; content: string; attachments?: Array<{ url: string }>; }

function headers(token: string) {
  return { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
}

async function fetchAll(channelId: string): Promise<DMsg[]> {
  const token = TOKEN();
  const all: DMsg[] = [];
  let before: string | undefined;
  while (true) {
    const url = new URL(`${BASE}/channels/${channelId}/messages`);
    url.searchParams.set('limit', '100');
    if (before) url.searchParams.set('before', before);
    const res = await fetch(url.toString(), { headers: headers(token) });
    if (!res.ok) break;
    const batch: DMsg[] = await res.json();
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < 100) break;
    before = batch[batch.length - 1].id;
  }
  return all;
}

async function post(channelId: string, content: string): Promise<DMsg> {
  const res = await fetch(`${BASE}/channels/${channelId}/messages`, {
    method: 'POST', headers: headers(TOKEN()), body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Discord post failed: ${res.status}`);
  return res.json();
}

async function edit(channelId: string, msgId: string, content: string): Promise<void> {
  const res = await fetch(`${BASE}/channels/${channelId}/messages/${msgId}`, {
    method: 'PATCH', headers: headers(TOKEN()), body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Discord edit failed: ${res.status}`);
}

async function del(channelId: string, msgId: string): Promise<void> {
  await fetch(`${BASE}/channels/${channelId}/messages/${msgId}`, {
    method: 'DELETE', headers: { Authorization: `Bot ${TOKEN()}` },
  });
}

async function uploadFile(
  channelId: string,
  content: string,
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
): Promise<DMsg> {
  const fd = new FormData();
  fd.append('content', content);
  fd.append('files[0]', new Blob([buffer], { type: mimeType }), filename);
  const res = await fetch(`${BASE}/channels/${channelId}/messages`, {
    method: 'POST', headers: { Authorization: `Bot ${TOKEN()}` }, body: fd,
  });
  if (!res.ok) throw new Error(`Discord upload failed: ${res.status}`);
  return res.json();
}

// ─── Store Config (with TTL cache) ───────────────────────────────────────────

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

let _cfgCache: StoreConfig | null = null;
let _cfgTime = 0;
const CFG_TTL = 20_000;

export async function getStoreConfig(): Promise<StoreConfig> {
  const now = Date.now();
  if (_cfgCache && now - _cfgTime < CFG_TTL) return _cfgCache;
  try {
    const msgs = await fetchAll(CH_CFG());
    for (const m of msgs) {
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
  const content = JSON.stringify({ ...data, __type: 'store_config' });
  if (_messageId) {
    await edit(CH_CFG(), _messageId, content);
    _cfgCache = config;
  } else {
    const msg = await post(CH_CFG(), content);
    _cfgCache = { ...config, _messageId: msg.id };
  }
  _cfgTime = Date.now();
  return _cfgCache!;
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
  const msg = await post(CH_USR(), JSON.stringify(u));
  return { ...u, _messageId: msg.id };
}

export async function updateUsuario(u: Usuario): Promise<void> {
  if (!u._messageId) throw new Error('Missing _messageId');
  const { _messageId, foto_url, ...data } = u;
  await edit(CH_USR(), _messageId, JSON.stringify(data));
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

export async function getAllAgendamentos(): Promise<Agendamento[]> {
  return (await fetchAll(CH_AGD())).map(parseAg).filter(Boolean) as Agendamento[];
}

export const getAgendamentoById       = async (id: string)       => (await getAllAgendamentos()).find(a => a.id === id) ?? null;
export const getAgendamentosByUsuario = async (id: string)       => (await getAllAgendamentos()).filter(a => a.usuario_id === id);
export const getAgendamentosByBarbeiro = async (id: string)      => (await getAllAgendamentos()).filter(a => a.barbeiro_id === id);
export const getAgendamentosByUnidade = async (id: string)       => (await getAllAgendamentos()).filter(a => a.unidade_id === id);

export async function getHorariosOcupados(barbeiroId: string, data: string): Promise<string[]> {
  const all = await getAllAgendamentos();
  return all.filter(a => a.barbeiro_id === barbeiroId && a.data === data && a.status !== 'cancelado').map(a => a.horario);
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

// ─── Manutenção ───────────────────────────────────────────────────────────────

export async function getMaintenanceConfig(): Promise<MaintenanceConfig> {
  try {
    for (const m of await fetchAll(CH_CFG())) {
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
  const content = JSON.stringify({ ...data, __type: 'maintenance_config' });
  if (_messageId) {
    await edit(CH_CFG(), _messageId, content);
    return cfg;
  }
  const msg = await post(CH_CFG(), content);
  return { ...cfg, _messageId: msg.id };
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
