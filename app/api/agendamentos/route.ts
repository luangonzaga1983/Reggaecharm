import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  createAgendamento, getAllAgendamentos, getAgendamentoById,
  getAgendamentosByUsuario, getHorariosOcupados, updateAgendamento,
  getUsuarioById, updateUsuario, getMediaEstrelas, getAgendamentosByBarbeiro,
  getAgendamentosByUnidade,
} from '@/lib/discord';
import { getSession, canDo } from '@/lib/auth';
import { BARBEIROS, SERVICOS, gerarHorarios } from '@/lib/data';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    if (action === 'horarios') {
      const barbeiroId = searchParams.get('barbeiro_id');
      const data = searchParams.get('data');
      if (!barbeiroId || !data) return NextResponse.json({ error: 'Parâmetros faltando' }, { status: 400 });
      const ocupados = await getHorariosOcupados(barbeiroId, data);
      const horarios = gerarHorarios(7, 20);
      return NextResponse.json({ horarios, ocupados });
    }

    if (action === 'meus') {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
      const ags = await getAgendamentosByUsuario(session.id);
      return NextResponse.json({ agendamentos: ags });
    }

    if (action === 'stats') {
      const stats = await Promise.all(
        BARBEIROS.map(async b => {
          const { media, total } = await getMediaEstrelas(b.id);
          return { barbeiroId: b.id, mediaEstrelas: media, totalAvaliacoes: total };
        })
      );
      return NextResponse.json({ stats });
    }

    // Admin: todos agendamentos (barbeiro vê os seus, gerente/dono vê todos)
    if (action === 'admin') {
      const session = await getSession();
      if (!session || !canDo(session.role, 'ver_todos_ag')) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      
      let ags;
      if (session.role === 'barbeiro') {
        // Barbeiro: pega seus agendamentos via barbeiro_id vinculado ao seu perfil
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

      const barbeiro = BARBEIROS.find(b => b.id === barbeiro_id);
      if (!barbeiro) return NextResponse.json({ error: 'Barbeiro não encontrado' }, { status: 404 });

      const servicoInfo = SERVICOS.find(s => s.nome === servico);
      if (!servicoInfo) return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 });

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
      if (!ehDono && !canDo(session.role, 'cancelar_alheio')) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
      }

      // Barbeiro só pode cancelar agendamentos com ele mesmo
      if (session.role === 'barbeiro' && !ehDono) {
        const usuario = await getUsuarioById(session.id);
        if (ag.barbeiro_id !== usuario?.barbeiro_id) {
          return NextResponse.json({ error: 'Só pode cancelar agendamentos com você' }, { status: 403 });
        }
      }

      ag.status = 'cancelado';
      await updateAgendamento(ag);
      return NextResponse.json({ ok: true });
    }

    if (action === 'confirmar') {
      // Gerente/dono pode confirmar agendamentos
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
        if (usuario) {
          usuario.pontos = (usuario.pontos || 0) + 5;
          await updateUsuario(usuario);
        }
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err) {
    console.error('[agendamentos POST]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
