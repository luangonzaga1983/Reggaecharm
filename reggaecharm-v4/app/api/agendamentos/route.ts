import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  createAgendamento, getAllAgendamentos, getAgendamentoById,
  getAgendamentosByUsuario, getHorariosOcupados, updateAgendamento,
  getUsuarioById, updateUsuario, getMediaEstrelas, getAgendamentosByBarbeiro,
  getAgendamentosByUnidade, getAllBarbeiros, getStoreConfig,
} from '@/lib/discord';
import { getSession, canDo } from '@/lib/auth';
import { gerarHorarios } from '@/lib/data';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    if (action === 'horarios') {
      const barbeiroId = searchParams.get('barbeiro_id');
      const data = searchParams.get('data');
      if (!barbeiroId || !data) return NextResponse.json({ error: 'Parâmetros faltando' }, { status: 400 });
      const ocupados = await getHorariosOcupados(barbeiroId, data);
      const horarios = gerarHorarios(7, 22); // fallback range, overridden by unidade in frontend
      return NextResponse.json({ horarios, ocupados });
    }

    if (action === 'meus') {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
      const ags = await getAgendamentosByUsuario(session.id);
      return NextResponse.json({ agendamentos: ags });
    }

    if (action === 'stats') {
      // Stats por barbeiro — usa barbeiros dinâmicos
      const barbeiros = await getAllBarbeiros();
      const stats = await Promise.all(
        barbeiros.map(async b => {
          const { media, total } = await getMediaEstrelas(b.id);
          return { barbeiroId: b.id, mediaEstrelas: media, totalAvaliacoes: total };
        })
      );
      return NextResponse.json({ stats });
    }

    if (action === 'admin') {
      const session = await getSession();
      if (!session || !canDo(session.role, 'ver_todos_ag')) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

      let ags;
      if (session.role === 'barbeiro') {
        const usuario = await getUsuarioById(session.id);
        ags = usuario?.barbeiro_id ? await getAgendamentosByBarbeiro(usuario.barbeiro_id) : [];
      } else if (session.role === 'gerente') {
        const usuario = await getUsuarioById(session.id);
        ags = usuario?.unidade_id ? await getAgendamentosByUnidade(usuario.unidade_id) : await getAllAgendamentos();
      } else {
        ags = await getAllAgendamentos();
      }
      return NextResponse.json({ agendamentos: ags });
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

    if (action === 'criar') {
      const { barbeiro_id, unidade_id, servico, data, horario } = body;
      if (!barbeiro_id || !servico || !data || !horario) return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 });

      // Busca valor do serviço na config dinâmica
      const config = await getStoreConfig();
      const servicoInfo = config.servicos.find(s => s.nome === servico && s.ativo);
      if (!servicoInfo) return NextResponse.json({ error: 'Serviço não encontrado ou inativo' }, { status: 404 });

      const ocupados = await getHorariosOcupados(barbeiro_id, data);
      if (ocupados.includes(horario)) return NextResponse.json({ error: 'Horário já ocupado' }, { status: 409 });

      const ag = await createAgendamento({
        id: uuidv4(), usuario_id: session.id, barbeiro_id, unidade_id: unidade_id || '',
        servico, data, horario, valor: servicoInfo.valor, status: 'pendente', avaliacao: null,
      });
      return NextResponse.json({ agendamento: ag });
    }

    if (action === 'cancelar') {
      const ag = await getAgendamentoById(body.agendamento_id);
      if (!ag) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
      const ehDono = ag.usuario_id === session.id;
      if (!ehDono && !canDo(session.role, 'cancelar_alheio')) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
      if (session.role === 'barbeiro' && !ehDono) {
        const usuario = await getUsuarioById(session.id);
        if (ag.barbeiro_id !== usuario?.barbeiro_id) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      }
      ag.status = 'cancelado';
      await updateAgendamento(ag);
      return NextResponse.json({ ok: true });
    }

    if (action === 'confirmar') {
      if (!canDo(session.role, 'ver_todos_ag')) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      const ag = await getAgendamentoById(body.agendamento_id);
      if (!ag) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
      ag.status = 'confirmado';
      await updateAgendamento(ag);
      return NextResponse.json({ ok: true });
    }

    if (action === 'avaliar') {
      const { agendamento_id, estrelas } = body;
      if (!estrelas || estrelas < 1 || estrelas > 5) return NextResponse.json({ error: 'Estrelas inválidas' }, { status: 400 });
      const ag = await getAgendamentoById(agendamento_id);
      if (!ag) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
      if (ag.usuario_id !== session.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
      const jaAvaliado = !!ag.avaliacao;
      ag.avaliacao = estrelas;
      await updateAgendamento(ag);
      if (!jaAvaliado) {
        const usuario = await getUsuarioById(session.id);
        if (usuario) { usuario.pontos = (usuario.pontos || 0) + 5; await updateUsuario(usuario); }
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err) {
    console.error('[agendamentos POST]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
