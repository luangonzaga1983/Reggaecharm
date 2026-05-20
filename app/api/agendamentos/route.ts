import { NextRequest, NextResponse } from 'next/server';
import {
  createAgendamento, getAllAgendamentos, getAgendamentoById,
  getAgendamentosByUsuario, getHorariosOcupados, updateAgendamento,
  getUsuarioById, updateUsuario, getMediaEstrelas, getAgendamentosByBarbeiro,
  getAgendamentosByUnidade, getAllBarbeiros, getStoreConfig,
} from '@/lib/discord';
import { getSession, canDo } from '@/lib/auth';
import { gerarHorarios } from '@/utils';
import { ok, err, unauth, forbidden, notFound, serverErr } from '@/lib/api';
import { validateDate, validateTime, sanitizeString, validateStars } from '@/validators';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    if (action === 'horarios') {
      const barbeiroId = sanitizeString(searchParams.get('barbeiro_id'), 64);
      const data = validateDate(searchParams.get('data'));
      if (!barbeiroId || !data) return err('Parâmetros inválidos');
      const ocupados = await getHorariosOcupados(barbeiroId, data);
      return NextResponse.json({ horarios: gerarHorarios(7, 22), ocupados });
    }

    if (action === 'meus') {
      const session = await getSession();
      if (!session) return unauth();
      return NextResponse.json({ agendamentos: await getAgendamentosByUsuario(session.id) });
    }

    if (action === 'stats') {
      const barbeiros = await getAllBarbeiros();
      const stats = await Promise.all(
        barbeiros.map(async b => ({ barbeiroId: b.id, ...await getMediaEstrelas(b.id) }))
      );
      return NextResponse.json({ stats });
    }

    if (action === 'admin') {
      const session = await getSession();
      if (!session || !canDo(session.role, 'ver_todos_ag')) return forbidden();
      let ags;
      if (session.role === 'barbeiro') {
        const u = await getUsuarioById(session.id);
        ags = u?.barbeiro_id ? await getAgendamentosByBarbeiro(u.barbeiro_id) : [];
      } else if (session.role === 'gerente') {
        const u = await getUsuarioById(session.id);
        ags = u?.unidade_id ? await getAgendamentosByUnidade(u.unidade_id) : await getAllAgendamentos();
      } else {
        ags = await getAllAgendamentos();
      }
      return NextResponse.json({ agendamentos: ags });
    }

    return err('Ação inválida');
  } catch (e) {
    console.error('[agendamentos GET]', e);
    return serverErr();
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauth();

  try {
    const body = await req.json().catch(() => null);
    if (!body) return err('Payload inválido');
    const { action } = body;

    if (action === 'criar') {
      const barbeiro_id = sanitizeString(body.barbeiro_id, 64);
      const unidade_id  = sanitizeString(body.unidade_id, 64);
      const servico     = sanitizeString(body.servico, 100);
      const data        = validateDate(body.data);
      const horario     = validateTime(body.horario);
      if (!barbeiro_id || !servico || !data || !horario) return err('Campos obrigatórios inválidos');

      const config      = await getStoreConfig();
      const servicoInfo = config.servicos.find(s => s.nome === servico && s.ativo);
      if (!servicoInfo) return err('Serviço não encontrado ou inativo', 404);

      const ocupados = await getHorariosOcupados(barbeiro_id, data);
      if (ocupados.includes(horario)) return err('Horário já ocupado', 409);

      const ag = await createAgendamento({
        id: crypto.randomUUID(), usuario_id: session.id, barbeiro_id, unidade_id: unidade_id || '',
        servico, data, horario, valor: servicoInfo.valor, status: 'pendente', avaliacao: null,
      });
      return ok({ agendamento: ag });
    }

    if (action === 'cancelar') {
      const ag = await getAgendamentoById(sanitizeString(body.agendamento_id, 64));
      if (!ag) return notFound();
      const ehDono = ag.usuario_id === session.id;
      if (!ehDono && !canDo(session.role, 'cancelar_alheio')) return forbidden();
      if (session.role === 'barbeiro' && !ehDono) {
        const u = await getUsuarioById(session.id);
        if (ag.barbeiro_id !== u?.barbeiro_id) return forbidden();
      }
      ag.status = 'cancelado';
      await updateAgendamento(ag);
      return ok();
    }

    if (action === 'confirmar') {
      if (!canDo(session.role, 'ver_todos_ag')) return forbidden();
      const ag = await getAgendamentoById(sanitizeString(body.agendamento_id, 64));
      if (!ag) return notFound();
      ag.status = 'confirmado';
      await updateAgendamento(ag);
      return ok();
    }

    if (action === 'avaliar') {
      const estrelas = validateStars(body.estrelas);
      if (estrelas === null) return err('Estrelas inválidas (1-5)');
      const ag = await getAgendamentoById(sanitizeString(body.agendamento_id, 64));
      if (!ag) return notFound();
      if (ag.usuario_id !== session.id) return forbidden();
      const jaAvaliado = !!ag.avaliacao;
      ag.avaliacao = estrelas;
      await updateAgendamento(ag);
      if (!jaAvaliado) {
        const u = await getUsuarioById(session.id);
        if (u) { u.pontos = (u.pontos ?? 0) + 5; await updateUsuario(u); }
      }
      return ok();
    }

    return err('Ação inválida');
  } catch (e) {
    console.error('[agendamentos POST]', e);
    return serverErr();
  }
}
