import type { UnidadeConfig, UserRole, AppTab } from '@/types';

export const DIAS_NOMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

export const ROLE_LABEL: Record<UserRole, string> = {
  cliente: 'Cliente', barbeiro: 'Barbeiro', gerente: 'Gerente', dono: 'Dono',
};
export const ROLE_COLOR: Record<UserRole, string> = {
  cliente: 'var(--text-faint)', barbeiro: 'var(--green)',
  gerente: 'var(--yellow)', dono: 'var(--red)',
};
export const TEMA_COR_MAP: Record<string, string> = {
  green:  '#00C853',
  yellow: '#FFD600',
  red:    '#FF3D57',
  purple: '#A78BFA',
  blue:   '#38BDF8',
  custom: '#D4AF37',
};

export function applyStoreTheme(storeConfig: { tema_cor: string; tema_cor_custom?: string; modo_reggae?: boolean }) {
  if (typeof document === 'undefined') return;
  const cor = storeConfig.tema_cor === 'custom'
    ? (storeConfig.tema_cor_custom || '#D4AF37')
    : TEMA_COR_MAP[storeConfig.tema_cor] || '#D4AF37';
  document.documentElement.style.setProperty('--accent', cor);
  // Reggae override tudo
  if (storeConfig.modo_reggae) {
    document.body.classList.add('reggae-mode');
  } else {
    document.body.classList.remove('reggae-mode');
    // dim e dark aproximados
    document.documentElement.style.setProperty('--accent', cor);
  }
}
export const STATUS_BADGE: Record<string, string> = {
  confirmado: 'badge-green', pendente: 'badge-yellow', cancelado: 'badge-red',
};
export const TAB_LABEL: Record<AppTab, string> = {
  dashboard: 'Início', horarios: 'Horários', perfil: 'Meu Perfil',
  configuracoes: 'Conta', gerencia: 'Gerência',
};
export const ROLE_LEVEL: Record<UserRole, number> = {
  cliente: 0, barbeiro: 1, gerente: 2, dono: 3,
};

export function canDo(role: UserRole, action: string): boolean {
  const lvl = ROLE_LEVEL[role] ?? 0;
  switch (action) {
    case 'cancelar_alheio':    return lvl >= 1;
    case 'ver_todos_ag':       return lvl >= 1;
    case 'gerenciar_usuarios': return lvl >= 2;
    case 'acesso_admin':       return lvl >= 2;
    case 'promover':           return lvl >= 2;
    case 'config_loja':        return lvl >= 3;
    case 'tem_perfil_aba':     return lvl >= 1;
    default:                   return false;
  }
}

export function getTabsForRole(role: UserRole): AppTab[] {
  switch (role) {
    case 'cliente':  return ['dashboard', 'configuracoes'];
    case 'barbeiro': return ['dashboard', 'horarios', 'perfil', 'configuracoes'];
    default:         return ['dashboard', 'horarios', 'perfil', 'configuracoes', 'gerencia'];
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
