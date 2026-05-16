// app/api/agendamentos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  createAgendamento,
  getAllAgendamentos,
  getAgendamentoById,
  getAgendamentosByUsuario,
  getAgendamentosByBarbeiro,
  getHorariosOcupados,
  updateAgendamento,
  getUsuarioById,
  updateUsuario,
} from '@/lib/discord';
import { getSession } from '@/lib/auth';
import { BARBEIROS, SERVICOS, HORARIOS } from '@/lib/data';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    // Horários livres de um barbeiro numa data
    if (action === 'horarios') {
      const barbeiroId = searchParams.get('barbeiro_id');
      const data = searchParams.get('data');
      if (!barbeiroId || !data) {
        return NextResponse.json({ error: 'Parâmetros faltando' }, { status: 400 });
      }
      const ocupados = await getHorariosOcupados(barbeiroId, data);
      const livres = HORARIOS.filter(h => !ocupados.includes(h));
      return NextResponse.json({ horarios: HORARIOS, ocupados, livres });
    }

    // Agendamentos de um usuário (requer auth)
    if (action === 'meus') {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
      const ags = await getAgendamentosByUsuario(session.id);
      // Enrich with static data
      const enriched = ags.map(a => ({
        ...a,
        barbeiro: BARBEIROS.find(b => b.id === a.barbeiro_id),
        servicoInfo: SERVICOS.find(s => s.nome === a.servico),
      }));
      return NextResponse.json({ agendamentos: enriched });
    }

    // Agenda do barbeiro (painel) — requer auth mas qualquer usuário pode ver painel do próprio barbeiro
    if (action === 'barbeiro') {
      const barbeiroId = searchParams.get('barbeiro_id');
      const data = searchParams.get('data');
      if (!barbeiroId) return NextResponse.json({ error: 'barbeiro_id obrigatório' }, { status: 400 });

      const ags = await getAgendamentosByBarbeiro(barbeiroId);
      const filtered = data ? ags.filter(a => a.data === data) : ags;
      return NextResponse.json({ agendamentos: filtered });
    }

    // Stats para a página de início — médias de estrelas e próximos horários
    if (action === 'stats') {
      const { getMediaEstrelas } = await import('@/lib/discord');
      const stats = await Promise.all(
        BARBEIROS.map(async b => {
          const media = await getMediaEstrelas(b.id);
          return { barbeiroId: b.id, mediaEstrelas: media };
        })
      );
      return NextResponse.json({ stats });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err) {
    console.error('[agendamentos GET]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    const { action } = body;

    // Criar novo agendamento
    if (action === 'criar') {
      const { barbeiro_id, servico, data, horario } = body;

      if (!barbeiro_id || !servico || !data || !horario) {
        return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
      }

      // Verifica se barbeiro existe
      const barbeiro = BARBEIROS.find(b => b.id === barbeiro_id);
      if (!barbeiro) return NextResponse.json({ error: 'Barbeiro não encontrado' }, { status: 404 });

      // Verifica se serviço existe
      const servicoInfo = SERVICOS.find(s => s.nome === servico);
      if (!servicoInfo) return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 });

      // Verifica se horário já está ocupado
      const ocupados = await getHorariosOcupados(barbeiro_id, data);
      if (ocupados.includes(horario)) {
        return NextResponse.json({ error: 'Horário já ocupado' }, { status: 409 });
      }

      const ag = await createAgendamento({
        id: uuidv4(),
        usuario_id: session.id,
        barbeiro_id,
        servico,
        data,
        horario,
        valor: servicoInfo.valor,
        status: 'pendente',
        avaliacao: null,
      });

      return NextResponse.json({ agendamento: ag });
    }

    // Confirmar pagamento PIX
    if (action === 'confirmar_pagamento') {
      const { agendamento_id } = body;
      const ag = await getAgendamentoById(agendamento_id);
      if (!ag) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 });
      if (ag.usuario_id !== session.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });

      ag.status = 'confirmado';
      await updateAgendamento(ag);

      // Adiciona pontos ao usuário (10 por agendamento)
      const usuario = await getUsuarioById(session.id);
      if (usuario) {
        usuario.pontos = (usuario.pontos || 0) + 10;
        await updateUsuario(usuario);
      }

      return NextResponse.json({ ok: true, agendamento: ag });
    }

    // Cancelar agendamento
    if (action === 'cancelar') {
      const { agendamento_id } = body;
      const ag = await getAgendamentoById(agendamento_id);
      if (!ag) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 });
      if (ag.usuario_id !== session.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });

      ag.status = 'cancelado';
      await updateAgendamento(ag);
      return NextResponse.json({ ok: true });
    }

    // Avaliar agendamento
    if (action === 'avaliar') {
      const { agendamento_id, estrelas } = body;
      if (!estrelas || estrelas < 1 || estrelas > 5) {
        return NextResponse.json({ error: 'Avaliação deve ser entre 1 e 5' }, { status: 400 });
      }

      const ag = await getAgendamentoById(agendamento_id);
      if (!ag) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 });
      if (ag.usuario_id !== session.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
      if (ag.status !== 'confirmado') return NextResponse.json({ error: 'Só é possível avaliar agendamentos confirmados' }, { status: 400 });

      ag.avaliacao = estrelas;
      await updateAgendamento(ag);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err) {
    console.error('[agendamentos POST]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
