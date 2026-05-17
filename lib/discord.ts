// lib/discord.ts
// All Discord interactions — paginated reads, writes, updates

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const CHANNEL_USUARIOS = process.env.DISCORD_CHANNEL_USUARIOS!;
const CHANNEL_AGENDAMENTOS = process.env.DISCORD_CHANNEL_AGENDAMENTOS!;
const CHANNEL_BARBEIROS = process.env.DISCORD_CHANNEL_BARBEIROS!;
const BASE_URL = 'https://discord.com/api/v10';

const headers = {
  Authorization: `Bot ${DISCORD_TOKEN}`,
  'Content-Type': 'application/json',
};

// ─── Generic helpers ──────────────────────────────────────────────────────────

async function fetchAllMessages(channelId: string): Promise<DiscordMessage[]> {
  const all: DiscordMessage[] = [];
  let before: string | undefined = undefined;

  while (true) {
    const url = new URL(`${BASE_URL}/channels/${channelId}/messages`);
    url.searchParams.set('limit', '100');
    if (before) url.searchParams.set('before', before);

    const res = await fetch(url.toString(), { headers });
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
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Discord post failed: ${res.status}`);
  return res.json();
}

async function editMessage(channelId: string, messageId: string, content: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Discord edit failed: ${res.status}`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

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
  device_hash?: string;
  barbeiro_favorito: string | null;
  servico_favorito: string | null;
  horario_favorito: string | null;
  unidade_favorita: string | null;
  tema: 'dark' | 'light';
  pontos: number;
  role: UserRole;
  barbeiro_id?: string | null; // vínculo com id do BARBEIROS array (se role === 'barbeiro')
  unidade_id?: string | null;  // unidade do barbeiro/gerente
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

// ─── Parse helpers ────────────────────────────────────────────────────────────

function parseUsuario(msg: DiscordMessage): Usuario | null {
  try {
    const data = JSON.parse(msg.content);
    return { ...data, _messageId: msg.id };
  } catch {
    return null;
  }
}

function parseAgendamento(msg: DiscordMessage): Agendamento | null {
  try {
    const data = JSON.parse(msg.content);
    return { ...data, _messageId: msg.id };
  } catch {
    return null;
  }
}

// ─── Usuários ─────────────────────────────────────────────────────────────────

export async function getAllUsuarios(): Promise<Usuario[]> {
  const messages = await fetchAllMessages(CHANNEL_USUARIOS);
  return messages.map(parseUsuario).filter(Boolean) as Usuario[];
}

export async function getUsuarioByEmail(email: string): Promise<Usuario | null> {
  const usuarios = await getAllUsuarios();
  return usuarios.find(u => u.email === email.toLowerCase()) || null;
}

export async function getUsuarioById(id: string): Promise<Usuario | null> {
  const usuarios = await getAllUsuarios();
  return usuarios.find(u => u.id === id) || null;
}

export async function createUsuario(usuario: Omit<Usuario, '_messageId'>): Promise<Usuario> {
  const content = JSON.stringify(usuario);
  const msg = await postMessage(CHANNEL_USUARIOS, content);
  return { ...usuario, _messageId: msg.id };
}

export async function updateUsuario(usuario: Usuario): Promise<void> {
  if (!usuario._messageId) throw new Error('Missing message ID');
  const { _messageId, ...data } = usuario;
  await editMessage(CHANNEL_USUARIOS, _messageId, JSON.stringify(data));
}

// ─── Agendamentos ─────────────────────────────────────────────────────────────

export async function getAllAgendamentos(): Promise<Agendamento[]> {
  const messages = await fetchAllMessages(CHANNEL_AGENDAMENTOS);
  return messages.map(parseAgendamento).filter(Boolean) as Agendamento[];
}

export async function getAgendamentosByUsuario(usuarioId: string): Promise<Agendamento[]> {
  const all = await getAllAgendamentos();
  return all.filter(a => a.usuario_id === usuarioId);
}

export async function getAgendamentosByBarbeiro(barbeiroId: string): Promise<Agendamento[]> {
  const all = await getAllAgendamentos();
  return all.filter(a => a.barbeiro_id === barbeiroId);
}

export async function getAgendamentosByUnidade(unidadeId: string): Promise<Agendamento[]> {
  const all = await getAllAgendamentos();
  return all.filter(a => a.unidade_id === unidadeId);
}

export async function getAgendamentosByData(barbeiroId: string, data: string): Promise<Agendamento[]> {
  const all = await getAllAgendamentos();
  return all.filter(
    a => a.barbeiro_id === barbeiroId && a.data === data && a.status !== 'cancelado'
  );
}

export async function createAgendamento(ag: Omit<Agendamento, '_messageId'>): Promise<Agendamento> {
  const content = JSON.stringify(ag);
  const msg = await postMessage(CHANNEL_AGENDAMENTOS, content);
  return { ...ag, _messageId: msg.id };
}

export async function updateAgendamento(ag: Agendamento): Promise<void> {
  if (!ag._messageId) throw new Error('Missing message ID');
  const { _messageId, ...data } = ag;
  await editMessage(CHANNEL_AGENDAMENTOS, _messageId, JSON.stringify(data));
}

export async function getAgendamentoById(id: string): Promise<Agendamento | null> {
  const all = await getAllAgendamentos();
  return all.find(a => a.id === id) || null;
}

// ─── Stats helpers ────────────────────────────────────────────────────────────

export async function getMediaEstrelas(barbeiroId: string): Promise<{media: number; total: number}> {
  const ags = await getAgendamentosByBarbeiro(barbeiroId);
  const avaliados = ags.filter(a => a.avaliacao !== null && a.avaliacao > 0);
  if (avaliados.length === 0) return {media: 0, total: 0};
  const soma = avaliados.reduce((acc, a) => acc + (a.avaliacao || 0), 0);
  return {media: Math.round((soma / avaliados.length) * 10) / 10, total: avaliados.length};
}

export async function getHorariosOcupados(barbeiroId: string, data: string): Promise<string[]> {
  const ags = await getAgendamentosByData(barbeiroId, data);
  return ags.map(a => a.horario);
}

export async function deleteUsuario(messageId: string): Promise<void> {
  await fetch(`${BASE_URL}/channels/${CHANNEL_USUARIOS}/messages/${messageId}`, {
    method: 'DELETE',
    headers,
  });
}

// ─── Barbeiros dinâmicos ───────────────────────────────────────────────────────
// Cada barbeiro é uma mensagem no CHANNEL_BARBEIROS.
// A foto é salva como ATTACHMENT na própria mensagem (campo photo_message_id guarda
// o id da mensagem que tem o attachment). No login/fetch, sempre buscamos a mensagem
// atual para pegar a URL fresca — assim o link nunca expira.

export interface BarbeiroDB {
  id: string;
  nome: string;
  especialidades: string[];
  unidades: string[];           // ids de unidade
  emoji: string;
  ativo: boolean;
  photo_message_id?: string | null; // id da mensagem que contém o attachment da foto
  photo_url?: string | null;        // URL fresca, resolvida em runtime, nunca persistida
  _messageId?: string;
}

function parseBarbeiro(msg: DiscordMessage): BarbeiroDB | null {
  try {
    const data = JSON.parse(msg.content);
    // Resolve URL da foto direto do attachment da mensagem atual (sempre fresco)
    const photoUrl = msg.attachments?.[0]?.url ?? null;
    return { ...data, photo_url: photoUrl, _messageId: msg.id };
  } catch {
    return null;
  }
}

export async function getAllBarbeiros(): Promise<BarbeiroDB[]> {
  const messages = await fetchAllMessages(CHANNEL_BARBEIROS);
  return messages.map(parseBarbeiro).filter(Boolean) as BarbeiroDB[];
}

export async function getBarbeiroById(id: string): Promise<BarbeiroDB | null> {
  const all = await getAllBarbeiros();
  return all.find(b => b.id === id) || null;
}

// Cria barbeiro sem foto — retorna o objeto criado
export async function createBarbeiro(barbeiro: Omit<BarbeiroDB, '_messageId' | 'photo_url'>): Promise<BarbeiroDB> {
  const { photo_message_id, ...rest } = barbeiro;
  const content = JSON.stringify({ ...rest, photo_message_id: null });
  const msg = await postMessage(CHANNEL_BARBEIROS, content);
  return { ...barbeiro, photo_url: null, _messageId: msg.id };
}

// Atualiza dados textuais do barbeiro (sem mudar foto)
export async function updateBarbeiro(barbeiro: BarbeiroDB): Promise<void> {
  if (!barbeiro._messageId) throw new Error('Missing barbeiro message ID');
  const { _messageId, photo_url, ...data } = barbeiro;
  await editMessage(CHANNEL_BARBEIROS, _messageId, JSON.stringify(data));
}

// Upload de foto: envia nova mensagem com o arquivo como attachment,
// depois atualiza o campo photo_message_id do barbeiro para o id dessa mensagem.
// Na próxima leitura, a URL é resolvida do attachment da mensagem de foto.
// Como usamos a mensagem PRINCIPAL do barbeiro para guardar tudo, na verdade
// fazemos upload via multipart e guardamos o attachment na própria mensagem do barbeiro.
export async function uploadBarberPhoto(
  barbeiroMessageId: string,
  barbeiroData: BarbeiroDB,
  fileBuffer: ArrayBuffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  // Apaga a mensagem atual e recria com o attachment
  // (Discord não permite PATCH com novo attachment — só via nova mensagem)
  // Estratégia: DELETE + POST multipart com attachment + JSON no content
  await fetch(`${BASE_URL}/channels/${CHANNEL_BARBEIROS}/messages/${barbeiroMessageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
  });

  const { _messageId, photo_url, ...data } = barbeiroData;
  const jsonContent = JSON.stringify({ ...data, photo_message_id: null });

  const formData = new FormData();
  formData.append('content', jsonContent);
  formData.append('files[0]', new Blob([fileBuffer], { type: mimeType }), filename);

  const res = await fetch(`${BASE_URL}/channels/${CHANNEL_BARBEIROS}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Discord upload failed: ${res.status} ${err}`);
  }

  const newMsg: DiscordMessage = await res.json();
  const freshUrl = newMsg.attachments?.[0]?.url ?? '';
  return freshUrl; // Retorna URL fresca (o caller deve atualizar seu estado local)
}

export async function deleteBarbeiro(messageId: string): Promise<void> {
  await fetch(`${BASE_URL}/channels/${CHANNEL_BARBEIROS}/messages/${messageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
  });
}
