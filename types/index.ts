export type UserRole = 'cliente' | 'barbeiro' | 'gerente' | 'dono';
export type AppTab   = 'dashboard' | 'horarios' | 'perfil' | 'configuracoes' | 'gerencia' | 'financeiro';
export type AgStatus = 'confirmado' | 'cancelado' | 'pendente';
export type TemaApp  = 'dark' | 'light';
export type TemaCor  = 'original' | 'green' | 'yellow' | 'red' | 'purple' | 'blue' | 'reggae' | 'custom';
export type PresencaStatus = 'pendente' | 'compareceu' | 'faltou';
export type PixStatus      = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED' | 'CHARGED_BACK';
export type PixPurpose     = 'agendamento' | 'multa';

export interface Session {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
  /** Versão do token. Confrontada com Usuario.token_version a cada request —
   *  se o servidor incrementar (ban, troca de senha, rebaixamento), tokens
   *  antigos param de valer. Revogação de sessão sem denylist. */
  tv?: number;
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
  /** Valor total devido em multas pendentes (BRL). Bloqueia novos agendamentos quando > 0. */
  multa_pendente?: number | null;
  /** Histórico curto de faltas (timestamps ISO) — usado para mostrar no perfil. */
  faltas?: string[] | null;
  /** Apelido global definido pelo staff (visível só para barbeiro/gerente/dono). */
  apelido?: string | null;
  /** ISO do último push "tá na hora de cortar" enviado (anti-spam do cron). */
  ultimo_lembrete?: string | null;
  /** Contador de revogação de sessão. Incrementa em ban/troca-de-senha/rebaixamento
   *  → invalida todos os JWT emitidos antes. */
  token_version?: number | null;
  /** Saldo de crédito em BRL (ex: barbeiro removido). Abatido do valor do corte
   *  como carteira: cobre total ou parcial, o que sobrar fica pro próximo. */
  credito_saldo?: number | null;
  senha: string;
  _messageId?: string;
}

/** Recado num agendamento (cliente ↔ barbeiro). Sem "visualizado". */
export interface AvisoAg {
  id: string;
  agendamento_id: string;
  from_id: string;
  texto: string;
  created_at: string;
  _messageId?: string;
}

/** Avaliação direta de um barbeiro (1 por usuário, global). Define o ranking. */
export interface AvalBarbeiro {
  barbeiro_id: string;
  usuario_id: string;
  estrelas: number;
  updated_at: string;
  _messageId?: string;
}

/** Inscrição de Web Push (1 por dispositivo/navegador). */
export interface PushSub {
  id: string;
  usuario_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
  _messageId?: string;
}

/** Reserva de fila: 1 pessoa por slot ocupado. Vira agendamento se o slot vagar. */
export interface ReservaFila {
  id: string;
  barbeiro_id: string;
  unidade_id: string;
  servico: string;
  valor: number;
  data: string;
  horario: string;
  usuario_id: string;
  created_at: string;
  _messageId?: string;
}

/** Resumo do cliente enviado ao staff junto da agenda (escopo seguro). */
export interface ClienteResumo {
  nome: string;
  apelido: string | null;
  fiel: boolean;
  total_cortes: number;
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
  /** Pagamento confirmado pela gateway. */
  pago?: boolean | null;
  /** Transaction ID da SigiloPay (depois do generate). */
  pix_tx_id?: string | null;
  /** Identifier interno (gb_TS_RAND). */
  pix_identifier?: string | null;
  /** Status atual da cobrança PIX. */
  pix_status?: PixStatus | null;
  /** Timestamp ISO de quando foi pago (vindo do webhook). */
  pago_em?: string | null;
  /** Status de comparecimento (marcado pelo barbeiro/admin no dia ou depois). */
  presenca?: PresencaStatus | null;
  /** Multa aplicada por falta (BRL). Default 10. */
  multa_aplicada?: number | null;
  /** Forma de pagamento: 'pix' (online), 'dinheiro' (na barbearia) ou 'credito' (vale). */
  pagamento_metodo?: 'pix' | 'dinheiro' | 'credito' | null;
  /** Motivo de cancelamento automático (ex: 'barbeiro_removido'). */
  cancelado_motivo?: string | null;
  /** Crédito (BRL) abatido deste corte no momento do agendamento. PIX cobra valor − isto. */
  credito_usado?: number | null;
  /** ISO de criação. PIX não pago só segura o horário por uma janela curta. */
  criado_em?: string | null;
  /** Já enviou o push "falta 1h30" para este corte (anti-duplicata do cron). */
  aviso_corte?: boolean | null;
  _messageId?: string;
}

export interface PixTransaction {
  id: string;                  // tx id SigiloPay
  identifier: string;          // gb_TS_RAND
  usuario_id: string;
  purpose: PixPurpose;
  agendamento_id?: string | null;
  amount: number;
  status: PixStatus;
  qr_code_text: string;
  qr_code_base64: string;
  created_at: string;          // ISO
  paid_at?: string | null;
  expires_at: string;
  _messageId?: string;
}

/** Bloqueio de agenda do barbeiro: folga pontual (data) ou recorrente (dia da semana). */
export interface FolgaBlock {
  tipo: 'data' | 'semanal';
  /** 'yyyy-mm-dd' quando tipo='data'. */
  data?: string;
  /** 0=Dom … 6=Sáb quando tipo='semanal'. */
  weekday?: number;
  /** Folga o dia inteiro. Se false, usa inicio/fim. */
  dia_todo: boolean;
  /** 'HH:MM' quando dia_todo=false. */
  inicio?: string;
  fim?: string;
}

export interface BarbeiroDB {
  id: string;
  nome: string;
  especialidades: string[];
  unidades: string[];
  ativo: boolean;
  photo_message_id?: string | null;
  photo_url?: string | null;
  /** Horário de almoço recorrente (bloqueia todo dia de trabalho). */
  almoco?: { inicio: string; fim: string } | null;
  /** Folgas pontuais e recorrentes. */
  folgas?: FolgaBlock[];
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
  tema_cor_custom?: string;
  modo_reggae?: boolean;
  unidades: UnidadeConfig[];
  servicos: ServicoConfig[];
  /** Comissão por barbeiro: barbeiroId → percentual (0–100) sobre o valor do corte. */
  comissoes?: Record<string, number>;
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
