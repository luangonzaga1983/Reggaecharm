import type { UnidadeConfig, UserRole, AppTab, BarbeiroDB } from '@/types';

export const DIAS_NOMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

/** Mínimo de cortes concluídos (compareceu) para o cliente ser "FIEL". */
export const FIEL_MIN = 10;

/** Dias desde o último corte para sugerir "tá na hora de cortar" (1 semana + 3 dias). */
export const LEMBRETE_CORTE_DIAS = 10;

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
  reggae: '#2ea043', // base do modo reggae (verde); o tricolor é aplicado via CSS
  custom: '#00c853',
};

/** Gradiente das 3 cores do reggae (verde, amarelo, vermelho). */
export const REGGAE_GRADIENT = 'linear-gradient(120deg, #2ea043 0%, #ffd60a 50%, #e23b3b 100%)';

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Preto ou branco — o que tiver mais contraste sobre `hex` (texto em botão). */
function contrastOn(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const lin = rgb.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return L > 0.45 ? '#18181b' : '#ffffff';
}

/**
 * Aplica a cor de destaque da loja sobrescrevendo as CSS vars de accent no
 * <html> (inline → vence o tema claro/escuro e persiste ao alternar tema).
 * - 'reggae': verde como accent + atributo data-reggae="on" (CSS pinta o tricolor
 *   em botões primários, barra de progresso etc).
 * - 'custom': usa tema_cor_custom (#RRGGBB).
 * - demais: cor do TEMA_COR_MAP.
 */
export function applyStoreTheme(cfg?: { tema_cor?: string; tema_cor_custom?: string; modo_reggae?: boolean }) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const clear = () => {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-contrast');
    root.style.removeProperty('--accent-soft');
    root.removeAttribute('data-reggae');
  };
  if (!cfg?.tema_cor) { clear(); return; }

  const setAccent = (hex: string, contrast?: string) => {
    const rgb = hexToRgb(hex);
    if (!rgb) { clear(); return; }
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--accent-contrast', contrast ?? contrastOn(hex));
    root.style.setProperty('--accent-soft', `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.14)`);
  };

  if (cfg.tema_cor === 'reggae') {
    setAccent('#2ea043', '#0b0b0c');
    root.setAttribute('data-reggae', 'on');
    return;
  }
  root.removeAttribute('data-reggae');
  setAccent(cfg.tema_cor === 'custom' ? (cfg.tema_cor_custom || '#1f6feb') : (TEMA_COR_MAP[cfg.tema_cor] || '#1f6feb'));
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
