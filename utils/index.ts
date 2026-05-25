import type { UnidadeConfig, UserRole, AppTab, BarbeiroDB } from '@/types';

export const DIAS_NOMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

export const ROLE_LABEL: Record<UserRole, string> = {
  cliente: 'Cliente', barbeiro: 'Barbeiro', gerente: 'Gerente', dono: 'Dono',
};
export const ROLE_COLOR: Record<UserRole, string> = {
  cliente: 'var(--text-dim)',
  barbeiro: 'var(--accent)',
  gerente:  'var(--warning)',
  dono:     'var(--danger)',
};
export const TEMA_COR_MAP: Record<string, string> = {
  green:  '#00c853',
  yellow: '#ffd60a',
  red:    '#ff1744',
  purple: '#a78bfa',
  blue:   '#1f6feb',
  custom: '#00c853',
};

/**
 * No-op preservado por compatibilidade. O tema agora é monocromático
 * (claro/escuro) e controlado por `applyTheme`; a cor de destaque da loja
 * não altera mais a paleta global.
 */
export function applyStoreTheme(_storeConfig?: { tema_cor?: string; tema_cor_custom?: string; modo_reggae?: boolean }) {
  if (typeof document === 'undefined') return;
  document.body.classList.remove('rasta-mode');
}

export type Theme = 'dark' | 'light';
const THEME_KEY = 'rc-theme';

/** Lê o tema salvo (localStorage) ou cai na preferência do sistema. */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Aplica o tema ao documento e persiste a escolha. */
export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
}

export const STATUS_BADGE: Record<string, string> = {
  confirmado: 'badge-green',
  pendente:   'badge-yellow',
  cancelado:  'badge-red',
};

export const TAB_LABEL: Record<AppTab, string> = {
  dashboard:     'Início',
  horarios:      'Horários',
  perfil:        'Perfil',
  configuracoes: 'Conta',
  gerencia:      'Gerência',
  financeiro:    'Financeiro',
};

export const ROLE_LEVEL: Record<UserRole, number> = {
  cliente: 0, barbeiro: 1, gerente: 2, dono: 3,
};

export function canDo(role: UserRole, action: string): boolean {
  if (role === 'dono') return true;
  const lvl = ROLE_LEVEL[role] ?? 0;
  switch (action) {
    case 'cancelar_alheio':    return lvl >= 1;
    case 'ver_todos_ag':       return lvl >= 1;
    case 'gerenciar_usuarios': return lvl >= 2;
    case 'acesso_admin':       return lvl >= 2;
    case 'promover':           return lvl >= 2;
    case 'config_loja':        return false;
    case 'tem_perfil_aba':     return lvl >= 1;
    default:                   return false;
  }
}

export function getTabsForRole(role: UserRole): AppTab[] {
  switch (role) {
    case 'cliente':  return ['dashboard', 'configuracoes'];
    case 'barbeiro': return ['dashboard', 'horarios', 'perfil', 'configuracoes'];
    case 'gerente':  return ['dashboard', 'horarios', 'perfil', 'configuracoes', 'gerencia'];
    default:         return ['dashboard', 'horarios', 'financeiro', 'gerencia', 'configuracoes'];
  }
}

export function gerarHorarios(abertura: number, fechamento: number): string[] {
  const slots: string[] = [];
  for (let h = abertura; h < fechamento; h++) {
    slots.push(`${String(h).padStart(2,'0')}:00`);
    slots.push(`${String(h).padStart(2,'0')}:30`);
  }
  return slots;
}

/**
 * Slots bloqueados do barbeiro numa data: almoço (todo dia) + folgas
 * (pontual por data ou recorrente por dia da semana). Compara 'HH:MM'
 * lexicograficamente (24h zero-pad). Retorna também se é folga o dia inteiro.
 */
export function slotsBloqueados(
  barbeiro: Pick<BarbeiroDB, 'almoco' | 'folgas'>,
  data: string,
  slots: string[],
): { bloqueados: string[]; folgaDiaTodo: boolean } {
  const bloq = new Set<string>();
  let folgaDiaTodo = false;
  const weekday = new Date(`${data}T12:00`).getDay();

  const faixa = (inicio?: string, fim?: string) => {
    if (!inicio || !fim) return;
    for (const s of slots) if (s >= inicio && s < fim) bloq.add(s);
  };

  if (barbeiro.almoco?.inicio && barbeiro.almoco?.fim) {
    faixa(barbeiro.almoco.inicio, barbeiro.almoco.fim);
  }

  for (const f of barbeiro.folgas ?? []) {
    const bate = f.tipo === 'data' ? f.data === data
               : f.tipo === 'semanal' ? f.weekday === weekday
               : false;
    if (!bate) continue;
    if (f.dia_todo) { folgaDiaTodo = true; for (const s of slots) bloq.add(s); }
    else faixa(f.inicio, f.fim);
  }

  return { bloqueados: Array.from(bloq), folgaDiaTodo };
}

export function getUnidadeStatus(u: UnidadeConfig): { aberto: boolean; texto: string } {
  const now    = new Date();
  const dia    = now.getDay();
  const total  = now.getHours() * 60 + now.getMinutes();
  const abre   = u.horario.abertura * 60;
  const fecha  = u.horario.fechamento * 60;

  if (!u.dias_semana.includes(dia)) {
    const prox = u.dias_semana.find(d => d > dia) ?? u.dias_semana[0];
    return { aberto: false, texto: `Abre ${DIAS_NOMES[prox]}` };
  }
  if (total < abre)  return { aberto: false, texto: `Abre às ${String(u.horario.abertura).padStart(2,'0')}:00` };
  if (total >= fecha) return { aberto: false, texto: 'Fechado hoje' };
  const resta = fecha - total;
  return resta <= 60
    ? { aberto: true, texto: `Fecha em ${resta} min` }
    : { aberto: true, texto: `Até ${String(u.horario.fechamento).padStart(2,'0')}:00` };
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(`${iso}T12:00`).toLocaleDateString('pt-BR', opts);
}

export function initials(nome: string): string {
  return nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export function mediaEstrelas(avs: (number | null)[]): { media: number; total: number } {
  const valid = avs.filter((v): v is number => v !== null && v > 0);
  if (!valid.length) return { media: 0, total: 0 };
  return {
    media: Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * 10) / 10,
    total: valid.length,
  };
}
