// lib/discord.ts — v4: user photos, @username, store config dynamic

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const CHANNEL_USUARIOS = process.env.DISCORD_CHANNEL_USUARIOS!;
const CHANNEL_AGENDAMENTOS = process.env.DISCORD_CHANNEL_AGENDAMENTOS!;
const CHANNEL_BARBEIROS = process.env.DISCORD_CHANNEL_BARBEIROS!;
const CHANNEL_CONFIG = process.env.DISCORD_CHANNEL_CONFIG || process.env.DISCORD_CHANNEL_USUARIOS!;
const BASE_URL = 'https://discord.com/api/v10';

const discordHeaders = {
  Authorization: `Bot ${DISCORD_TOKEN}`,
  'Content-Type': 'application/json',
};

async function fetchAllMessages(channelId: string): Promise<DiscordMessage[]> {
  const all: DiscordMessage[] = [];
  let before: string | undefined = undefined;
  while (true) {
    const url = new URL(`${BASE_URL}/channels/${channelId}/messages`);
    url.searchParams.set('limit', '100');
    if (before) url.searchParams.set('before', before);
    const res = await fetch(url.toString(), { headers: discordHeaders });
    if (!res.ok) break;
    const batch: DiscordMessage[] = await res.json();
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
    before = batch[batch.length - 1].id;
  }
  return all;
}

async function postMessage(channelId: string, content: string): Promise<DiscordMessage> {
  const res = await fetch(`${BASE_URL}/channels/${channelId}/messages`, {
    method: 'POST', headers: discordHeaders, body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Discord post failed: ${res.status}`);
  return res.json();
}

async function editMessage(channelId: string, messageId: string, content: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH', headers: discordHeaders, body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Discord edit failed: ${res.status}`);
}

interface DiscordMessage {
  id: string;
  content: string;
  attachments?: Array<{ id: string; url: string; filename: string; content_type?: string }>;
}

export type UserRole = 'cliente' | 'barbeiro' | 'gerente' | 'dono';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senha: string;
  username?: string | null;
  foto_url?: string | null;
  device_hash?: string | null;
  barbeiro_favorito: string | null;
  servico_favorito: string | null;
  horario_favorito: string | null;
  unidade_favorita: string | null;
  tema: 'dark' | 'light';
  pontos: number;
  role: UserRole;
  barbeiro_id?: string | null;
  unidade_id?: string | null;
  _messageId?: string;
}

export interface Agendamento {
  id: string;
  usuario_id: string;
  barbeiro_id: string;
  servico: string;
  data: string;
  horario: string;
  valor: number;
  status: 'confirmado' | 'cancelado' | 'pendente';
  unidade_id: string;
  avaliacao: number | null;
  _messageId?: string;
}

export interface UnidadeConfig {
  id: string;
  nome: string;
  endereco: string;
  bairro: string;
  cidade: string;
  horario: { abertura: number; fechamento: number };
  dias_semana: number[];
  barbeiros: string[];
  ativo: boolean;
}

export interface ServicoConfig {
  id: string;
  nome: string;
  valor: number;
  duracao: number;
  descricao: string;
  ativo: boolean;
}

export interface StoreConfig {
  nome_loja: string;
  slogan: string;
  tema_cor: 'green' | 'yellow' | 'red' | 'purple' | 'blue';
  unidades: UnidadeConfig[];
  servicos: ServicoConfig[];
  _messageId?: string;
}

const DEFAULT_CONFIG: Omit<StoreConfig, '_messageId'> = {
  nome_loja: 'Reggae Charm',
  slogan: 'One Love, One Cut',
  tema_cor: 'green',
  unidades: [
    { id: 'u1', nome: 'Reggae Charm Centro', endereco: 'Rua das Palmeiras, 142', bairro: 'Centro', cidade: 'São Bernardo do Campo', horario: { abertura: 8, fechamento: 20 }, dias_semana: [1,2,3,4,5,6], barbeiros: ['b1','b2'], ativo: true },
    { id: 'u2', nome: 'Reggae Charm Paulista', endereco: 'Av. Paulista, 1023', bairro: 'Bela Vista', cidade: 'São Paulo', horario: { abertura: 9, fechamento: 21 }, dias_semana: [1,2,3,4,5,6], barbeiros: ['b3','b4'], ativo: true },
    { id: 'u3', nome: 'Reggae Charm ABC', endereco: 'Rua Goiás, 88', bairro: 'Nova Petrópolis', cidade: 'São Bernardo do Campo', horario: { abertura: 8, fechamento: 19 }, dias_semana: [1,2,3,4,5], barbeiros: ['b1','b3'], ativo: true },
    { id: 'u4', nome: 'Reggae Charm Sul', endereco: 'Av. Miguel Yunes, 500', bairro: 'Rudge Ramos', cidade: 'São Bernardo do Campo', horario: { abertura: 9, fechamento: 20 }, dias_semana: [1,2,3,4,5,6], barbeiros: ['b2','b4'], ativo: true },
  ],
  servicos: [
    { id: 's1', nome: 'Corte Clássico', valor: 35, duracao: 30, descricao: 'Tesoura ou máquina, acabamento perfeito', ativo: true },
    { id: 's2', nome: 'Degradê', valor: 40, duracao: 40, descricao: 'Degradê suave ou pesado do jeito que você quiser', ativo: true },
    { id: 's3', nome: 'Barba', valor: 25, duracao: 30, descricao: 'Navalha, modelagem e hidratação profunda', ativo: true },
    { id: 's4', nome: 'Corte + Barba', valor: 55, duracao: 60, descricao: 'O combo completo — sai outro', ativo: true },
    { id: 's5', nome: 'Black Power', valor: 45, duracao: 50, descricao: 'Definição e modelagem dos cachos naturais', ativo: true },
    { id: 's6', nome: 'Navalhado', valor: 50, duracao: 45, descricao: 'Precisão total com navalha artesanal', ativo: true },
    { id: 's7', nome: 'Progressiva de Barba', valor: 60, duracao: 60, descricao: 'Alisar e modelar com tratamento', ativo: true },
    { id: 's8', nome: 'Pézinho', valor: 20, duracao: 20, descricao: 'Acabamento no pescoço e contorno', ativo: true },
  ],
};

let _configCache: StoreConfig | null = null;
let _configCacheTime = 0;
const CONFIG_TTL = 20_000;

export async function getStoreConfig(): Promise<StoreConfig> {
  const now = Date.now();
  if (_configCache && now - _configCacheTime < CONFIG_TTL) return _configCache;
  try {
    const messages = await fetchAllMessages(CHANNEL_CONFIG);
    for (const msg of messages) {
      try {
        const data = JSON.parse(msg.content);
        if (data.__type === 'store_config') {
          _configCache = { ...data, _messageId: msg.id };
          _configCacheTime = now;
          return _configCache!;
        }
      } catch { /* skip */ }
    }
  } catch { /* use default */ }
  return { ...DEFAULT_CONFIG };
}

export async function saveStoreConfig(config: StoreConfig): Promise<StoreConfig> {
  const { _messageId, ...data } = config;
  const content = JSON.stringify({ ...data, __type: 'store_config' });
  if (_messageId) {
    await editMessage(CHANNEL_CONFIG, _messageId, content);
    _configCache = config;
  } else {
    const msg = await postMessage(CHANNEL_CONFIG, content);
    _configCache = { ...config, _messageId: msg.id };
  }
  _configCacheTime = Date.now();
  return _configCache!;
}

// ─── Usuários ─────────────────────────────────────────────────────────────────

function parseUsuario(msg: DiscordMessage): Usuario | null {
  try {
    const data = JSON.parse(msg.content);
    if (data.__type) return null;
    const photoUrl = msg.attachments?.[0]?.url ?? null;
    return { ...data, foto_url: photoUrl, _messageId: msg.id };
  } catch { return null; }
}

export async function getAllUsuarios(): Promise<Usuario[]> {
  const messages = await fetchAllMessages(CHANNEL_USUARIOS);
  return messages.map(parseUsuario).filter(Boolean) as Usuario[];
}

export async function getUsuarioByEmail(email: string): Promise<Usuario | null> {
  const all = await getAllUsuarios();
  return all.find(u => u.email === email.toLowerCase()) || null;
}

export async function getUsuarioByUsername(username: string): Promise<Usuario | null> {
  const all = await getAllUsuarios();
  return all.find(u => u.username?.toLowerCase() === username.toLowerCase()) || null;
}

export async function getUsuarioById(id: string): Promise<Usuario | null> {
  const all = await getAllUsuarios();
  return all.find(u => u.id === id) || null;
}

export async function createUsuario(usuario: Omit<Usuario, '_messageId'>): Promise<Usuario> {
  const msg = await postMessage(CHANNEL_USUARIOS, JSON.stringify(usuario));
  return { ...usuario, _messageId: msg.id };
}

export async function updateUsuario(usuario: Usuario): Promise<void> {
  if (!usuario._messageId) throw new Error('Missing message ID');
  const { _messageId, foto_url, ...data } = usuario;
  await editMessage(CHANNEL_USUARIOS, _messageId, JSON.stringify(data));
}

export async function uploadUserPhoto(
  userMessageId: string, userData: Usuario,
  fileBuffer: ArrayBuffer, filename: string, mimeType: string,
): Promise<string> {
  await fetch(`${BASE_URL}/channels/${CHANNEL_USUARIOS}/messages/${userMessageId}`, {
    method: 'DELETE', headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
  });
  const { _messageId, foto_url, ...data } = userData;
  const formData = new FormData();
  formData.append('content', JSON.stringify(data));
  formData.append('files[0]', new Blob([fileBuffer], { type: mimeType }), filename);
  const res = await fetch(`${BASE_URL}/channels/${CHANNEL_USUARIOS}/messages`, {
    method: 'POST', headers: { Authorization: `Bot ${DISCORD_TOKEN}` }, body: formData,
  });
  if (!res.ok) throw new Error(`Discord upload failed: ${res.status}`);
  const newMsg: DiscordMessage = await res.json();
  return newMsg.attachments?.[0]?.url ?? '';
}

export async function deleteUsuario(messageId: string): Promise<void> {
  await fetch(`${BASE_URL}/channels/${CHANNEL_USUARIOS}/messages/${messageId}`, {
    method: 'DELETE', headers: discordHeaders,
  });
}

// ─── Agendamentos ─────────────────────────────────────────────────────────────

function parseAgendamento(msg: DiscordMessage): Agendamento | null {
  try {
    const data = JSON.parse(msg.content);
    if (data.__type) return null;
    return { ...data, _messageId: msg.id };
  } catch { return null; }
}

export async function getAllAgendamentos(): Promise<Agendamento[]> {
  const messages = await fetchAllMessages(CHANNEL_AGENDAMENTOS);
  return messages.map(parseAgendamento).filter(Boolean) as Agendamento[];
}

export async function getAgendamentosByUsuario(id: string) {
  return (await getAllAgendamentos()).filter(a => a.usuario_id === id);
}

export async function getAgendamentosByBarbeiro(id: string) {
  return (await getAllAgendamentos()).filter(a => a.barbeiro_id === id);
}

export async function getAgendamentosByUnidade(id: string) {
  return (await getAllAgendamentos()).filter(a => a.unidade_id === id);
}

export async function getAgendamentosByData(barbeiroId: string, data: string) {
  return (await getAllAgendamentos()).filter(
    a => a.barbeiro_id === barbeiroId && a.data === data && a.status !== 'cancelado'
  );
}

export async function createAgendamento(ag: Omit<Agendamento, '_messageId'>): Promise<Agendamento> {
  const msg = await postMessage(CHANNEL_AGENDAMENTOS, JSON.stringify(ag));
  return { ...ag, _messageId: msg.id };
}

export async function updateAgendamento(ag: Agendamento): Promise<void> {
  if (!ag._messageId) throw new Error('Missing message ID');
  const { _messageId, ...data } = ag;
  await editMessage(CHANNEL_AGENDAMENTOS, _messageId, JSON.stringify(data));
}

export async function getAgendamentoById(id: string): Promise<Agendamento | null> {
  return (await getAllAgendamentos()).find(a => a.id === id) || null;
}

export async function getMediaEstrelas(barbeiroId: string) {
  const ags = await getAgendamentosByBarbeiro(barbeiroId);
  const avaliados = ags.filter(a => a.avaliacao !== null && a.avaliacao > 0);
  if (avaliados.length === 0) return { media: 0, total: 0 };
  const soma = avaliados.reduce((acc, a) => acc + (a.avaliacao || 0), 0);
  return { media: Math.round((soma / avaliados.length) * 10) / 10, total: avaliados.length };
}

export async function getHorariosOcupados(barbeiroId: string, data: string) {
  const ags = await getAgendamentosByData(barbeiroId, data);
  return ags.map(a => a.horario);
}

// ─── Barbeiros dinâmicos ───────────────────────────────────────────────────────

export interface BarbeiroDB {
  id: string;
  nome: string;
  especialidades: string[];
  unidades: string[];
  ativo: boolean;
  photo_message_id?: string | null;
  photo_url?: string | null;
  _messageId?: string;
}

function parseBarbeiro(msg: DiscordMessage): BarbeiroDB | null {
  try {
    const data = JSON.parse(msg.content);
    if (data.__type) return null;
    return { ...data, photo_url: msg.attachments?.[0]?.url ?? null, _messageId: msg.id };
  } catch { return null; }
}

export async function getAllBarbeiros(): Promise<BarbeiroDB[]> {
  const messages = await fetchAllMessages(CHANNEL_BARBEIROS);
  return messages.map(parseBarbeiro).filter(Boolean) as BarbeiroDB[];
}

export async function getBarbeiroById(id: string): Promise<BarbeiroDB | null> {
  return (await getAllBarbeiros()).find(b => b.id === id) || null;
}

export async function createBarbeiro(barbeiro: Omit<BarbeiroDB, '_messageId' | 'photo_url'>): Promise<BarbeiroDB> {
  const { photo_message_id, ...rest } = barbeiro;
  const msg = await postMessage(CHANNEL_BARBEIROS, JSON.stringify({ ...rest, photo_message_id: null }));
  return { ...barbeiro, photo_url: null, _messageId: msg.id };
}

export async function updateBarbeiro(barbeiro: BarbeiroDB): Promise<void> {
  if (!barbeiro._messageId) throw new Error('Missing barbeiro message ID');
  const { _messageId, photo_url, ...data } = barbeiro;
  await editMessage(CHANNEL_BARBEIROS, _messageId, JSON.stringify(data));
}

export async function uploadBarberPhoto(
  barbeiroMessageId: string, barbeiroData: BarbeiroDB,
  fileBuffer: ArrayBuffer, filename: string, mimeType: string,
): Promise<string> {
  await fetch(`${BASE_URL}/channels/${CHANNEL_BARBEIROS}/messages/${barbeiroMessageId}`, {
    method: 'DELETE', headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
  });
  const { _messageId, photo_url, ...data } = barbeiroData;
  const formData = new FormData();
  formData.append('content', JSON.stringify({ ...data, photo_message_id: null }));
  formData.append('files[0]', new Blob([fileBuffer], { type: mimeType }), filename);
  const res = await fetch(`${BASE_URL}/channels/${CHANNEL_BARBEIROS}/messages`, {
    method: 'POST', headers: { Authorization: `Bot ${DISCORD_TOKEN}` }, body: formData,
  });
  if (!res.ok) throw new Error(`Discord upload failed: ${res.status}`);
  const newMsg: DiscordMessage = await res.json();
  return newMsg.attachments?.[0]?.url ?? '';
}

export async function deleteBarbeiro(messageId: string): Promise<void> {
  await fetch(`${BASE_URL}/channels/${CHANNEL_BARBEIROS}/messages/${messageId}`, {
    method: 'DELETE', headers: discordHeaders,
  });
}
