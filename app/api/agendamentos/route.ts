import { NextRequest, NextResponse } from 'next/server';
import {
  createAgendamento, getAllAgendamentos, getAgendamentoById,
  getAgendamentosByUsuario, getHorariosOcupados, updateAgendamento,
  getUsuarioById, updateUsuario, getMediaEstrelas, getAgendamentosByBarbeiro,
  getAgendamentosByUnidade, getAllBarbeiros, getBarbeiroById, getStoreConfig,
  getPixTxsByUsuario, updatePixTransaction,
} from '@/lib/discord';
import { getPixStatus } from '@/lib/sigilo';
import { getSession, canDo } from '@/lib/auth';
import { gerarHorarios, slotsBloqueados } from '@/utils';
import { ok, err, unauth, forbidden, notFound, serverErr } from '@/lib/api';
import { auditFromSession } from '@/lib/audit';
import { clientIp, maintenanceGuard } from '@/lib/security';
import { validateDate, validateTime, sanitizeString, validateStars } from '@/validators';
import type { PresencaStatus } from '@/types';

const MULTA_FALTA_BRL = 10;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    if (action === 'horarios') {
      const barbeiroId = sanitizeString(searchParams.get('barbeiro_id'), 64);
      const data = validateDate(searchParams.get('data'));
      if (!barbeiroId || !data) return err('Parâmetros inválidos');
      const agendados = await getHorariosOcupados(barbeiroId, data);
      const barbeiro = await getBarbeiroById(barbeiroId);
      const { bloqueados, folgaDiaTodo } = barbeiro
        ? slotsBloqueados(barbeiro, data, gerarHorarios(0, 24))
        : { bloqueados: [], folgaDiaTodo: false };
      const ocupados = Array.from(new Set([...agendados, ...bloqueados]));
      return NextResponse.json({ horarios: gerarHorarios(7, 22), ocupados, folga_dia_todo: folgaDiaTodo });
    }

    if (action === 'meus') {
      const session = await getSession();
      if (!session) return unauth();
      // Reconcilia PIX pendentes (sem webhook — polling on-demand)
      await reconcilePendingPix(session.id);
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
  const blocked = await maintenanceGuard(session);
  if (blocked) return blocked;
  const ip = clientIp(req);
  const ua = req.headers.get('user-agent') || undefined;

  try {
    const raw = await req.text();
    if (raw.length > 8_000) return err('Payload muito grande');
    const body = raw ? JSON.parse(raw) : null;
    if (!body || typeof body !== 'object') return err('Payload inválido');
    const { action } = body;

    if (action === 'criar') {
      // BLOQUEIO: usuário com multa pendente não pode agendar
      const u = await getUsuarioById(session.id);
      if (u && Number(u.multa_pendente ?? 0) > 0) {
        return err(`Você possui multa pendente de R$ ${Number(u.multa_pendente).toFixed(2)}. Quite antes de agendar.`, 402);
      }

      const barbeiro_id = sanitizeString(body.barbeiro_id, 64);
      const unidade_id  = sanitizeString(body.unidade_id, 64);
      const servico     = sanitizeString(body.servico, 100);
      const data        = validateDate(body.data);
      const horario     = validateTime(body.horario);
      if (!barbeiro_id || !servico || !data || !horario) return err('Campos obrigatórios inválidos');

      const hoje = new Date().toISOString().split('T')[0];
      if (data < hoje) return err('Data no passado não permitida');

      const config      = await getStoreConfig();
      const servicoInfo = config.servicos.find(s => s.nome === servico && s.ativo);
      if (!servicoInfo) return err('Serviço não encontrado ou inativo', 404);

      const barbeiros = await getAllBarbeiros();
      const barbeiro  = barbeiros.find(b => b.id === barbeiro_id && b.ativo);
      if (!barbeiro) return err('Barbeiro indisponível', 404);

      if (unidade_id) {
        const un = config.unidades.find(u => u.id === unidade_id && u.ativo);
        if (!un) return err('Unidade inválida', 404);
      }

      const ocupados = await getHorariosOcupados(barbeiro_id, data);
      if (ocupados.includes(horario)) return err('Horário já ocupado', 409);

      // Bloqueio por almoço/folga do barbeiro (defesa server-side)
      const { bloqueados } = slotsBloqueados(barbeiro, data, gerarHorarios(0, 24));
      if (bloqueados.includes(horario)) return err('Horário indisponível (folga ou almoço do barbeiro)', 409);

      // Agendamento já nasce confirmado — o barbeiro não precisa aceitar.
      const ag = await createAgendamento({
        id: crypto.randomUUID(), usuario_id: session.id, barbeiro_id, unidade_id: unidade_id || '',
        servico, data, horario, valor: servicoInfo.valor, status: 'confirmado', avaliacao: null,
        pago: false, pix_status: null, pix_tx_id: null, pix_identifier: null, pago_em: null,
        presenca: 'pendente', multa_aplicada: null,
      });
      return ok({ agendamento: ag });
    }

    if (action === 'marcar_presenca') {
      // Apenas barbeiro do agendamento ou admin (gerente+/dono)
      if (!canDo(session.role, 'ver_todos_ag')) return forbidden();
      const ag = await getAgendamentoById(sanitizeString(body.agendamento_id, 64));
      if (!ag) return notFound();
      if (session.role === 'barbeiro') {
        const me = await getUsuarioById(session.id);
        if (ag.barbeiro_id !== me?.barbeiro_id) return forbidden();
      }
      const presenca = body.presenca as PresencaStatus;
      if (presenca !== 'compareceu' && presenca !== 'faltou') return err('presenca inválida');
      if (ag.status === 'cancelado') return err('Agendamento cancelado — não pode marcar presença');

      // Só permite marcar presença a partir do horário do corte (nunca antes).
      const inicioCorte = new Date(`${ag.data}T${ag.horario}:00`).getTime();
      if (Number.isFinite(inicioCorte) && Date.now() < inicioCorte) {
        return err('Só é possível marcar presença a partir do horário do corte');
      }

      const before = ag.presenca ?? 'pendente';
      if (before === presenca) return ok({ agendamento: ag });

      // Se já era falta, reverte multa anterior antes de aplicar nova decisão
      if (before === 'faltou' && ag.multa_aplicada) {
        const cliente = await getUsuarioById(ag.usuario_id);
        if (cliente) {
          cliente.multa_pendente = Math.max(0, Number(cliente.multa_pendente ?? 0) - Number(ag.multa_aplicada));
          if (Array.isArray(cliente.faltas)) {
            cliente.faltas = cliente.faltas.filter(t => t !== `${ag.id}`);
          }
          await updateUsuario(cliente);
        }
        ag.multa_aplicada = null;
      }

      ag.presenca = presenca;

      if (presenca === 'faltou') {
        const cliente = await getUsuarioById(ag.usuario_id);
        if (cliente) {
          cliente.multa_pendente = Number(cliente.multa_pendente ?? 0) + MULTA_FALTA_BRL;
          cliente.faltas = [...(cliente.faltas ?? []), ag.id].slice(-50);
          await updateUsuario(cliente);
        }
        ag.multa_aplicada = MULTA_FALTA_BRL;
      } else {
        ag.multa_aplicada = null;
      }

      await updateAgendamento(ag);
      auditFromSession(session, 'config_change', {
        target_id: ag.id, target_label: ag.usuario_id,
        meta: { entity: 'presenca', from: before, to: presenca, multa: ag.multa_aplicada ?? 0 },
        ip, ua,
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
      if (!ehDono) auditFromSession(session, 'delete_appointment', { target_id: ag.id, ip, ua });
      return ok();
    }

    if (action === 'confirmar') {
      if (!canDo(session.role, 'ver_todos_ag')) return forbidden();
      const ag = await getAgendamentoById(sanitizeString(body.agendamento_id, 64));
      if (!ag) return notFound();
      if (session.role === 'barbeiro') {
        const u = await getUsuarioById(session.id);
        if (ag.barbeiro_id !== u?.barbeiro_id) return forbidden();
      }
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
      if (ag.status !== 'confirmado') return err('Só é possível avaliar agendamentos confirmados');
      if (ag.presenca !== 'compareceu') return err('Só é possível avaliar após confirmar comparecimento');
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

/**
 * Reconcilia transações PIX PENDING do usuário consultando SigiloPay.
 * Substitui o webhook: chamado on-demand quando o usuário lista agendamentos.
 * - Idempotente (compara status armazenado vs gateway)
 * - Aplica efeitos: marca agendamento pago / quita multa
 * - Falhas no gateway são silenciadas (não bloqueia listagem)
 */
async function reconcilePendingPix(usuarioId: string): Promise<void> {
  try {
    const txs = await getPixTxsByUsuario(usuarioId);
    const pendentes = txs.filter(t => t.status === 'PENDING');
    if (!pendentes.length) return;

    // Limite defensivo: nunca consultar mais que 10 por request
    const lote = pendentes.slice(0, 10);

    await Promise.all(lote.map(async tx => {
      try {
        const remote: any = await getPixStatus(tx.id);
        if (!remote || remote.status === tx.status) return;
        tx.status = remote.status;

        if (remote.status === 'PAID') {
          tx.paid_at = remote.paidAt ?? new Date().toISOString();
          if (tx.purpose === 'agendamento' && tx.agendamento_id) {
            const ag = await getAgendamentoById(tx.agendamento_id);
            if (ag && !ag.pago) {
              ag.pago = true;
              ag.pix_status = 'PAID';
              ag.pago_em = tx.paid_at;
              ag.status = 'confirmado';
              await updateAgendamento(ag);
            }
          } else if (tx.purpose === 'multa') {
            const u = await getUsuarioById(tx.usuario_id);
            if (u) {
              const atual = Number(u.multa_pendente ?? 0);
              u.multa_pendente = Math.max(0, atual - tx.amount);
              await updateUsuario(u);
            }
          }
        }

        await updatePixTransaction(tx);
      } catch { /* gateway indisponível: tenta na próxima */ }
    }));
  } catch { /* canal PIX indisponível: silencia */ }
}
