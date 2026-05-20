export type UserRole = 'cliente' | 'barbeiro' | 'gerente' | 'dono';
export type AppTab   = 'dashboard' | 'horarios' | 'perfil' | 'configuracoes' | 'gerencia';
export type AgStatus = 'confirmado' | 'cancelado' | 'pendente';
export type TemaApp  = 'dark' | 'light';
export type TemaCor  = 'green' | 'yellow' | 'red' | 'purple' | 'blue' | 'custom';

export interface Session {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  username?: string | null;
  foto_url?: string | null;
  device_hash?: string | null;
  barbeiro_favorito: string | null;
  servico_favorito: string | null;
  horario_favorito: string | null;
  unidade_favorita: string | null;
  tema: TemaApp;
  pontos: number;
  role: UserRole;
  barbeiro_id?: string | null;
  unidade_id?: string | null;
  banido?: boolean | null;
  ban_motivo?: string | null;
  ban_ip?: string | null;
  senha: string;
  _messageId?: string;
}

export type UsuarioSafe = Omit<Usuario, 'senha'>;

export interface Agendamento {
  id: string;
  usuario_id: string;
  barbeiro_id: string;
  unidade_id: string;
  servico: string;
  data: string;
  horario: string;
  valor: number;
  status: AgStatus;
  avaliacao: number | null;
  _messageId?: string;
}

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
  tema_cor: TemaCor;
  tema_cor_custom?: string;   // hex livre quando tema_cor === 'custom'
  modo_reggae?: boolean;
  unidades: UnidadeConfig[];
  servicos: ServicoConfig[];
  _messageId?: string;
}

export interface MaintenanceConfig {
  ativo: boolean;
  mensagem: string;
  _messageId?: string;
}

export interface FotoBarbeiro {
  id: string;
  barbeiro_id: string;
  descricao: string;
  data: string;
  foto_url?: string | null;
  _messageId?: string;
}

export interface BarbeiroStats {
  barbeiroId: string;
  mediaEstrelas: number;
  totalAvaliacoes: number;
}
