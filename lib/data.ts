// lib/data.ts

export interface Unidade {
  id: string;
  nome: string;
  endereco: string;
  bairro: string;
  cidade: string;
  horario: { abertura: number; fechamento: number };
  barbeiros: string[];
}

export interface Barbeiro {
  id: string;
  nome: string;
  especialidades: string[];
  unidades: string[];
  emoji: string;
}

export interface Servico {
  id: string;
  nome: string;
  valor: number;
  duracao: number;
  descricao: string;
}

export const UNIDADES: Unidade[] = [
  { id: 'u1', nome: 'Reggae Charm Centro', endereco: 'Rua das Palmeiras, 142', bairro: 'Centro', cidade: 'São Bernardo do Campo', horario: { abertura: 8, fechamento: 20 }, barbeiros: ['b1', 'b2'] },
  { id: 'u2', nome: 'Reggae Charm Paulista', endereco: 'Av. Paulista, 1023', bairro: 'Bela Vista', cidade: 'São Paulo', horario: { abertura: 9, fechamento: 21 }, barbeiros: ['b3', 'b4'] },
  { id: 'u3', nome: 'Reggae Charm ABC', endereco: 'Rua Goiás, 88', bairro: 'Nova Petrópolis', cidade: 'São Bernardo do Campo', horario: { abertura: 8, fechamento: 19 }, barbeiros: ['b1', 'b3'] },
  { id: 'u4', nome: 'Reggae Charm Sul', endereco: 'Av. Miguel Yunes, 500', bairro: 'Rudge Ramos', cidade: 'São Bernardo do Campo', horario: { abertura: 9, fechamento: 20 }, barbeiros: ['b2', 'b4'] },
];

export const BARBEIROS: Barbeiro[] = [
  { id: 'b1', nome: 'João Silva', especialidades: ['Degradê', 'Barba', 'Pézinho'], unidades: ['u1', 'u3'], emoji: '✂️' },
  { id: 'b2', nome: 'Carlos Roots', especialidades: ['Navalhado', 'Black Power', 'Tranças'], unidades: ['u1', 'u4'], emoji: '💈' },
  { id: 'b3', nome: 'Diego Marley', especialidades: ['Corte Clássico', 'Degradê', 'Barba'], unidades: ['u2', 'u3'], emoji: '🪒' },
  { id: 'b4', nome: 'Rafael One', especialidades: ['Afro', 'Dreadlock', 'Barba Longa'], unidades: ['u2', 'u4'], emoji: '⚡' },
];

export const SERVICOS: Servico[] = [
  { id: 's1', nome: 'Corte Clássico', valor: 35, duracao: 30, descricao: 'Tesoura ou máquina, acabamento perfeito' },
  { id: 's2', nome: 'Degradê', valor: 40, duracao: 40, descricao: 'Degradê suave ou pesado do jeito que você quiser' },
  { id: 's3', nome: 'Barba', valor: 25, duracao: 30, descricao: 'Navalha, modelagem e hidratação profunda' },
  { id: 's4', nome: 'Corte + Barba', valor: 55, duracao: 60, descricao: 'O combo completo — sai outro' },
  { id: 's5', nome: 'Black Power', valor: 45, duracao: 50, descricao: 'Definição e modelagem dos cachos naturais' },
  { id: 's6', nome: 'Navalhado', valor: 50, duracao: 45, descricao: 'Precisão total com navalha artesanal' },
  { id: 's7', nome: 'Progressiva de Barba', valor: 60, duracao: 60, descricao: 'Alisar e modelar com tratamento' },
  { id: 's8', nome: 'Pézinho', valor: 20, duracao: 20, descricao: 'Acabamento no pescoço e contorno' },
];

export function gerarHorarios(abertura: number, fechamento: number): string[] {
  const slots: string[] = [];
  for (let h = abertura; h < fechamento; h++) {
    slots.push(String(h).padStart(2, '0') + ':00');
    slots.push(String(h).padStart(2, '0') + ':30');
  }
  return slots;
}

export function getUnidadeStatus(u: Unidade): { aberto: boolean; texto: string } {
  const now = new Date();
  const total = now.getHours() * 60 + now.getMinutes();
  const abre = u.horario.abertura * 60;
  const fecha = u.horario.fechamento * 60;
  const aberto = total >= abre && total < fecha;
  if (!aberto) {
    if (total < abre) return { aberto: false, texto: 'Abre às ' + String(u.horario.abertura).padStart(2,'0') + ':00' };
    return { aberto: false, texto: 'Fechado hoje' };
  }
  const resta = fecha - total;
  if (resta <= 60) return { aberto: true, texto: 'Fecha em ' + resta + ' min' };
  return { aberto: true, texto: 'Aberto até ' + String(u.horario.fechamento).padStart(2,'0') + ':00' };
}
