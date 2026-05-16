// lib/data.ts — Dados predefinidos (hardcoded)

export interface Barbeiro {
  id: string;
  nome: string;
  especialidades: string[];
  foto?: string;
  bio?: string;
}

export interface Servico {
  id: string;
  nome: string;
  valor: number;
  duracao: number; // minutos
  descricao?: string;
}

export const BARBEIROS: Barbeiro[] = [
  {
    id: 'b1',
    nome: 'João Silva',
    especialidades: ['degradê', 'barba'],
    bio: 'Mestre do degradê perfeito, 8 anos de experiência na navalha.',
  },
  {
    id: 'b2',
    nome: 'Carlos Roots',
    especialidades: ['navalhado', 'black'],
    bio: 'Especialista em cortes afro e navalhado preciso. Raízes no reggae.',
  },
];

export const SERVICOS: Servico[] = [
  {
    id: 's1',
    nome: 'Corte',
    valor: 35.0,
    duracao: 30,
    descricao: 'Corte clássico ou moderno, na tesoura ou máquina.',
  },
  {
    id: 's2',
    nome: 'Barba',
    valor: 25.0,
    duracao: 30,
    descricao: 'Aparar, modelar e hidratar. Navalha inclusa.',
  },
  {
    id: 's3',
    nome: 'Corte + Barba',
    valor: 55.0,
    duracao: 60,
    descricao: 'O combo completo. Sai novo, sai charmoso.',
  },
];

// Horários fixos das 07:00 às 18:00, a cada 30 minutos
export function gerarHorarios(): string[] {
  const horarios: string[] = [];
  for (let h = 7; h < 18; h++) {
    horarios.push(`${String(h).padStart(2, '0')}:00`);
    horarios.push(`${String(h).padStart(2, '0')}:30`);
  }
  horarios.push('18:00');
  return horarios;
}

export const HORARIOS = gerarHorarios();

export function getBarbeiro(id: string): Barbeiro | undefined {
  return BARBEIROS.find(b => b.id === id);
}

export function getServico(id: string): Servico | undefined {
  return SERVICOS.find(s => s.id === id);
}

export function getServicoByNome(nome: string): Servico | undefined {
  return SERVICOS.find(s => s.nome.toLowerCase() === nome.toLowerCase());
}
