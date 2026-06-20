import { NextRequest, NextResponse } from 'next/server';
import {
  createAgendamento, getAllAgendamentos, getAgendamentoById,
  getAgendamentosByUsuario, getHorariosOcupados, updateAgendamento,
  getUsuarioById, updateUsuario, getMediaEstrelas, getAgendamentosByBarbeiro,
  getAgendamentosByUnidade, getAllBarbeiros, getBarbeiroById, getStoreConfig,
  getPixTxsByUsuario, updatePixTransaction, getAllUsuarios,
  getAllReservas, getReservaBySlot, getReservasByUsuario, createReserva, deleteReserva,
  seguraSlot, getAvisosByAgendamento, getAllAvisos, createAviso,
} from '@/lib/discord';
import { getPixStatus } from '@/lib/sigilo';
import { pushToDonos, pushToUsuario } from '@/lib/push';
import { getLiveSession, canDo } from '@/lib/auth';
import { gerarHorarios, slotsBloqueados, FIEL_MIN } from '@/utils';
import { ok, err, unauth, forbidden, notFound, serverErr } from '@/lib/api';
import { auditFromSession } from '@/lib/audit';
import { clientIp, maintenanceGuard } from '@/lib/security';
import { validateDate, validateTime, sanitizeString, validateStars } from '@/validators';
import { hojeSP } from '@/lib/datetime';
import type { PresencaStatus } from '@/types';

const MULTA_FALTA_BRL = 10;

/** Pode ver/mandar recado neste agendamento? Cliente dono, barbeiro do corte, ou admin. */
async function podeVerAviso(session: { id: string; role: any }, ag: { usuario_id: string; barbeiro_id: string }): Promise<boolean> {
  if (ag.usuario_id === session.id) return true;
  if (!canDo(session.role, 'ver_todos_ag')) return false;
  if (session.role === 'barbeiro') {
    const u = await getUsuarioById(session.id);
    return u?.barbeiro_id === ag.barbeiro_id;
  }
  return true; // gerente/dono
}

/** Data 'yyyy-mm-dd' → "qua, 28 mai" (pt-BR), para corpo de notificação. */
function fmtData(iso: string): string {
  try { return new Date(`${iso}T12:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }); }
  catch { return iso; }
}

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
      // ocupados = só agendamentos reais (fila-ável). bloqueados = almoço/folga
      // (indisponível, SEM fila) — devolvidos separados pro front diferenciar.
      const ocupados = agendados;
      const reservados = (await getAllReservas())
        .filter(r => r.barbeiro_id === barbeiroId && r.data === data)
        .map(r => r.horario);
      return NextResponse.json({ horarios: gerarHorarios(7, 22), ocupados, bloqueados, folga_dia_todo: folgaDiaTodo, reservados });
    }

    if (action === 'meus') {
      const session = await getLiveSession();
      if (!session) return unauth();
      // Reconcilia PIX pendentes (sem webhook — polling on-demand)
      await reconcilePendingPix(session.id);
      // Limpa fantasmas: PIX não pago e vencido vira cancelado (e devolve crédito).
      await cancelExpiredUnpaid(session.id);
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
      const session = await getLiveSession();
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

      // Resumo do cliente (escopo: só dos agendamentos visíveis ao staff).
      // Inclui apelido + FIEL (cortes concluídos no total da loja).
      const users = await getAllUsuarios();
      const byId = new Map(users.map(u => [u.id, u]));
      const todasAgs = await getAllAgendamentos();
      const totalCortes = new Map<string, number>();
      for (const a of todasAgs) {
        if (a.presenca === 'compareceu') totalCortes.set(a.usuario_id, (totalCortes.get(a.usuario_id) ?? 0) + 1);
      }
      const clientes: Record<string, { nome: string; apelido: string | null; fiel: boolean; total_cortes: number }> = {};
      for (const id of Array.from(new Set(ags.map(a => a.usuario_id)))) {
        const cu = byId.get(id);
        const total = totalCortes.get(id) ?? 0;
        clientes[id] = { nome: cu?.nome ?? '—', apelido: cu?.apelido ?? null, fiel: total >= FIEL_MIN, total_cortes: total };
      }
      return NextResponse.json({ agendamentos: ags, clientes });
    }

    if (action === 'avisos') {
      const session = await getLiveSession();
      if (!session) return unauth();
      const agId = sanitizeString(searchParams.get('agendamento_id'), 64);
      const ag = await getAgendamentoById(agId);
      if (!ag) return notFound();
      if (!(await podeVerAviso(session, ag))) return forbidden();
      return NextResponse.json({ avisos: await getAvisosByAgendamento(agId) });
    }

    if (action === 'avisos_count') {
      const session = await getLiveSession();
      if (!session) return unauth();
      let agIds: Set<string> | null = null; // null = admin (vê todos)
      if (!canDo(session.role, 'ver_todos_ag')) {
        agIds = new Set((await getAgendamentosByUsuario(session.id)).map(a => a.id));
      } else if (session.role === 'barbeiro') {
        const u = await getUsuarioById(session.id);
        agIds = new Set((u?.barbeiro_id ? await getAgendamentosByBarbeiro(u.barbeiro_id) : []).map(a => a.id));
      }
      const counts: Record<string, number> = {};
      for (const m of await getAllAvisos()) {
        if (agIds && !agIds.has(m.agendamento_id)) continue;
        counts[m.agendamento_id] = (counts[m.agendamento_id] || 0) + 1;
      }
      return NextResponse.json({ counts });
    }

    return err('Ação inválida');
  } catch (e) {
    console.error('[agendamentos GET]', e);
    return serverErr();
  }
}

export async function POST(req: NextRequest) {
  const session = await getLiveSession();
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

      // Teto de agendamentos ativos por usuário (anti-abuso/DoS de agenda).
      // Cliente não trava todos os slots; staff/dono fica livre p/ operar.
      if (session.role === 'cliente') {
        const hojeStr = hojeSP();
        const ativos = (await getAgendamentosByUsuario(session.id))
          .filter(a => a.status !== 'cancelado' && a.data >= hojeStr && (a.presenca ?? 'pendente') === 'pendente');
        if (ativos.length >= 5) {
          return err('Você atingiu o limite de 5 agendamentos ativos. Conclua ou cancele algum antes de marcar outro.', 429);
        }
      }

      const barbeiro_id = sanitizeString(body.barbeiro_id, 64);
      const unidade_id  = sanitizeString(body.unidade_id, 64);
      const servico     = sanitizeString(body.servico, 100);
      const data        = validateDate(body.data);
      const horario     = validateTime(body.horario);
      if (!barbeiro_id || !servico || !data || !horario) return err('Campos obrigatórios inválidos');

      const hoje = hojeSP();
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

      // Crédito como CARTEIRA: abate do valor do corte. Cobre total ou parcial;
      // o que sobrar do saldo fica pro próximo. PIX cobra (valor − desconto).
      // Re-lê o usuário agora (após os awaits acima) p/ pegar saldo mais fresco
      // e reduzir a janela de gasto-duplo em cliques quase-simultâneos.
      const uAtual = await getUsuarioById(session.id);
      const saldo = Number(uAtual?.credito_saldo ?? 0);
      const desconto = Math.min(Math.max(0, saldo), servicoInfo.valor);
      const aPagar = Math.round((servicoInfo.valor - desconto) * 100) / 100;
      // Sub-R$1 (PIX tem mínimo de R$1): a loja cobre os centavos → sai grátis.
      const coberturaTotal = aPagar < 1;

      const metodo: 'pix' | 'dinheiro' | 'credito' = coberturaTotal
        ? 'credito'
        : (body.pagamento_metodo === 'dinheiro' ? 'dinheiro' : 'pix');

      // Agendamento já nasce confirmado — o barbeiro não precisa aceitar.
      const ag = await createAgendamento({
        id: crypto.randomUUID(), usuario_id: session.id, barbeiro_id, unidade_id: unidade_id || '',
        servico, data, horario, valor: servicoInfo.valor, status: 'confirmado', avaliacao: null,
        pago: coberturaTotal, pix_status: null, pix_tx_id: null, pix_identifier: null,
        pago_em: coberturaTotal ? new Date().toISOString() : null,
        presenca: 'pendente', multa_aplicada: null,
        credito_usado: desconto > 0 ? desconto : null,
        pagamento_metodo: metodo, aviso_corte: false,
        criado_em: new Date().toISOString(),
      });

      // Anti-corrida (Discord não tem transação): se dois caíram no mesmo slot,
      // vence o de message id mais antigo (snowflake) e o nosso é desfeito.
      try {
        const mesmoSlot = (await getAllAgendamentos({ fresh: true }))
          .filter(x => x.barbeiro_id === barbeiro_id && x.data === data && x.horario === horario && x.status !== 'cancelado');
        if (mesmoSlot.length > 1) {
          const vencedor = mesmoSlot.reduce((a, b) => ((a._messageId ?? '') < (b._messageId ?? '') ? a : b));
          if (vencedor.id !== ag.id) {
            ag.status = 'cancelado';
            await updateAgendamento(ag);
            return err('Esse horário acabou de ser ocupado. Escolha outro.', 409);
          }
        }
      } catch { /* verificação best-effort */ }

      // Debita o crédito só agora (agendamento sobreviveu ao anti-corrida).
      if (desconto > 0 && uAtual) {
        uAtual.credito_saldo = Math.round((saldo - desconto) * 100) / 100;
        try { await updateUsuario(uAtual); } catch { /* não trava o fluxo */ }
      }

      // Dinheiro: avisa o dono que tem reserva pra pagar na barbearia.
      if (metodo === 'dinheiro') {
        try {
          const cfg = await getStoreConfig();
          const barbeiroNome = barbeiro?.nome ?? 'barbeiro';
          await pushToDonos({
            title: cfg.nome_loja,
            body: `Reserva p/ pagar na barbearia — R$ ${servicoInfo.valor.toFixed(2)} · ${servico} com ${barbeiroNome}, ${fmtData(data)} às ${horario}.`,
            tag: `dinheiro-${ag.id}`,
          });
        } catch { /* push opcional */ }
      }
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
      const motivoCancel = sanitizeString(body.motivo, 200);
      if (!motivoCancel) return err('Informe o motivo do cancelamento', 400);
      ag.cancelado_motivo  = motivoCancel;
      ag.cancelado_por     = ehDono ? 'cliente' : session.role;
      ag.cancel_aviso_visto = false; // aparece p/ o outro lado na próxima vez que abrir

      // Devolve ao saldo o crédito que tinha sido abatido (corte não aconteceu).
      if (Number(ag.credito_usado ?? 0) > 0 && (ag.presenca ?? 'pendente') === 'pendente') {
        const dono = await getUsuarioById(ag.usuario_id);
        if (dono) {
          dono.credito_saldo = Math.round((Number(dono.credito_saldo ?? 0) + Number(ag.credito_usado)) * 100) / 100;
          await updateUsuario(dono);
        }
        ag.credito_usado = null;
      }

      ag.status = 'cancelado';
      await updateAgendamento(ag);
      if (!ehDono) auditFromSession(session, 'delete_appointment', { target_id: ag.id, ip, ua });

      // Promove a fila: se o slot ficou livre e havia reserva, vira agendamento.
      try {
        const aindaOcupado = (await getHorariosOcupados(ag.barbeiro_id, ag.data)).includes(ag.horario);
        if (!aindaOcupado) {
          const reserva = await getReservaBySlot(ag.barbeiro_id, ag.data, ag.horario);
          if (reserva) {
            // Não promove quem está com multa pendente (mesma regra do agendar).
            const filaUser = await getUsuarioById(reserva.usuario_id);
            if (filaUser && Number(filaUser.multa_pendente ?? 0) > 0) {
              if (reserva._messageId) await deleteReserva(reserva._messageId);
              try {
                const cfg = await getStoreConfig();
                await pushToUsuario(reserva.usuario_id, {
                  title: `Vagou na ${cfg.nome_loja}, mas...`,
                  body: `Abriu o horário que você queria, porém há multa pendente. Quite a multa e agende — é rápido.`,
                  tag: `fila-multa-${reserva.id}`,
                });
              } catch { /* push opcional */ }
              return ok();
            }
            await createAgendamento({
              id: crypto.randomUUID(), usuario_id: reserva.usuario_id, barbeiro_id: reserva.barbeiro_id,
              unidade_id: reserva.unidade_id, servico: reserva.servico, data: reserva.data, horario: reserva.horario,
              valor: reserva.valor, status: 'confirmado', avaliacao: null, pago: false,
              pix_status: null, pix_tx_id: null, pix_identifier: null, pago_em: null,
              presenca: 'pendente', multa_aplicada: null,
              criado_em: new Date().toISOString(),
            });
            if (reserva._messageId) await deleteReserva(reserva._messageId);
            try {
              const cfg = await getStoreConfig();
              const bNome = (await getBarbeiroById(reserva.barbeiro_id))?.nome ?? 'seu barbeiro';
              await pushToUsuario(reserva.usuario_id, {
                title: `Vagou na ${cfg.nome_loja}!`,
                body: `O horário que você estava na fila abriu: ${reserva.servico} com ${bNome}, ${fmtData(reserva.data)} às ${reserva.horario}. Abra o app e finalize o pagamento para garantir — quem não paga perde a vez.`,
                tag: `fila-${reserva.id}`,
              });
            } catch { /* push opcional */ }
          }
        }
      } catch (e) { console.error('[promover fila]', e); }
      return ok();
    }

    if (action === 'reagendar') {
      const ag = await getAgendamentoById(sanitizeString(body.agendamento_id, 64));
      if (!ag) return notFound();
      const ehDono = ag.usuario_id === session.id;
      if (!ehDono && !canDo(session.role, 'ver_todos_ag')) return forbidden();
      if (session.role === 'barbeiro' && !ehDono) {
        const me = await getUsuarioById(session.id);
        if (ag.barbeiro_id !== me?.barbeiro_id) return forbidden();
      }
      if (ag.status === 'cancelado') return err('Agendamento cancelado');
      if ((ag.presenca ?? 'pendente') !== 'pendente') return err('Corte já resolvido — não dá para reagendar');

      // Cliente com multa não reagenda (mesma regra do agendar).
      if (ehDono) {
        const ureag = await getUsuarioById(session.id);
        if (ureag && Number(ureag.multa_pendente ?? 0) > 0) {
          return err(`Você possui multa pendente de R$ ${Number(ureag.multa_pendente).toFixed(2)}. Quite antes de reagendar.`, 402);
        }
      }

      const data    = validateDate(body.data);
      const horario = validateTime(body.horario);
      if (!data || !horario) return err('Data ou horário inválidos');
      const hoje = hojeSP();
      if (data < hoje) return err('Data no passado não permitida');
      if (data === ag.data && horario === ag.horario) return ok({ agendamento: ag });

      const ocupados = await getHorariosOcupados(ag.barbeiro_id, data);
      if (ocupados.includes(horario)) return err('Horário já ocupado', 409);
      const barbeiro = await getBarbeiroById(ag.barbeiro_id);
      if (barbeiro) {
        const { bloqueados } = slotsBloqueados(barbeiro, data, gerarHorarios(0, 24));
        if (bloqueados.includes(horario)) return err('Horário indisponível (folga ou almoço do barbeiro)', 409);
      }

      const de = { data: ag.data, horario: ag.horario };
      ag.data = data; ag.horario = horario;
      await updateAgendamento(ag);
      auditFromSession(session, 'config_change', { target_id: ag.id, meta: { entity: 'reagendar', de, para: { data, horario } }, ip, ua });
      return ok({ agendamento: ag });
    }

    if (action === 'reservar_fila') {
      const u = await getUsuarioById(session.id);
      if (u && Number(u.multa_pendente ?? 0) > 0) {
        return err(`Você possui multa pendente de R$ ${Number(u.multa_pendente).toFixed(2)}. Quite antes de entrar na fila.`, 402);
      }
      const barbeiro_id = sanitizeString(body.barbeiro_id, 64);
      const unidade_id  = sanitizeString(body.unidade_id, 64);
      const servico     = sanitizeString(body.servico, 100);
      const data        = validateDate(body.data);
      const horario     = validateTime(body.horario);
      if (!barbeiro_id || !servico || !data || !horario) return err('Campos obrigatórios inválidos');
      const hoje = hojeSP();
      if (data < hoje) return err('Data no passado não permitida');

      const config      = await getStoreConfig();
      const servicoInfo = config.servicos.find(s => s.nome === servico && s.ativo);
      if (!servicoInfo) return err('Serviço não encontrado ou inativo', 404);
      const barbeiro = await getBarbeiroById(barbeiro_id);
      if (!barbeiro?.ativo) return err('Barbeiro indisponível', 404);

      // Só entra na fila se o horário estiver realmente ocupado.
      const ocupados = await getHorariosOcupados(barbeiro_id, data);
      if (!ocupados.includes(horario)) return err('Horário livre — agende normalmente', 409);
      // Não reservar o próprio horário.
      const meusNoSlot = (await getAgendamentosByBarbeiro(barbeiro_id))
        .some(a => a.data === data && a.horario === horario && a.status !== 'cancelado' && a.usuario_id === session.id);
      if (meusNoSlot) return err('Você já tem esse horário', 409);
      // Máximo 1 reserva por slot.
      if (await getReservaBySlot(barbeiro_id, data, horario)) return err('Já tem alguém na fila desse horário', 409);

      const reserva = await createReserva({
        id: crypto.randomUUID(), barbeiro_id, unidade_id: unidade_id || '', servico,
        valor: servicoInfo.valor, data, horario, usuario_id: session.id,
        created_at: new Date().toISOString(),
      });
      return ok({ reserva });
    }

    if (action === 'cancelar_reserva') {
      const r = (await getReservasByUsuario(session.id)).find(x => x.id === sanitizeString(body.reserva_id, 64));
      if (!r?._messageId) return notFound();
      await deleteReserva(r._messageId);
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

    if (action === 'avisar') {
      const agId  = sanitizeString(body.agendamento_id, 64);
      const texto = sanitizeString(body.texto, 300);
      if (!agId || !texto) return err('Mensagem vazia');
      const ag = await getAgendamentoById(agId);
      if (!ag) return notFound();
      if (!(await podeVerAviso(session, ag))) return forbidden();
      const existentes = await getAvisosByAgendamento(agId);
      if (existentes.length >= 30) return err('Limite de recados atingido neste agendamento');
      const aviso = await createAviso(agId, session.id, texto);
      return ok({ aviso });
    }

    if (action === 'cancel_aviso_visto') {
      const ag = await getAgendamentoById(sanitizeString(body.agendamento_id, 64));
      if (!ag) return notFound();
      // Só o destinatário do aviso (ou admin) marca como visto.
      if (!(await podeVerAviso(session, ag))) return forbidden();
      ag.cancel_aviso_visto = true;
      await updateAgendamento(ag);
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
              // Push: venda aprovada → dono; confirmação → cliente.
              try {
                const [cfg, bar, cli] = await Promise.all([
                  getStoreConfig(), getBarbeiroById(ag.barbeiro_id), getUsuarioById(ag.usuario_id),
                ]);
                const bNome = bar?.nome ?? 'barbeiro';
                const cNome = cli?.nome?.split(' ')[0] ?? 'cliente';
                await Promise.all([
                  pushToDonos({
                    title: `Pagamento recebido — ${cfg.nome_loja}`,
                    body: `R$ ${tx.amount.toFixed(2)} de ${cNome} · ${ag.servico} com ${bNome}, ${fmtData(ag.data)} às ${ag.horario}.`,
                    tag: `venda-${ag.id}`,
                  }),
                  pushToUsuario(ag.usuario_id, {
                    title: `Pagamento confirmado!`,
                    body: `Seu ${ag.servico} com ${bNome} está garantido para ${fmtData(ag.data)} às ${ag.horario}. Te esperamos na ${cfg.nome_loja}!`,
                    tag: `pago-${ag.id}`,
                  }),
                ]);
              } catch { /* push opcional */ }
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

/**
 * Cancela agendamentos PIX não pagos e vencidos (passaram da janela de hold).
 * Deixa o histórico limpo (status 'cancelado', motivo 'pix_expirado') e devolve
 * o crédito que tinha sido abatido. O slot em si já fica livre via seguraSlot().
 */
async function cancelExpiredUnpaid(usuarioId: string): Promise<void> {
  try {
    const ags = await getAgendamentosByUsuario(usuarioId);
    for (const a of ags) {
      if (a.status === 'cancelado') continue;
      if (a.pago || a.pagamento_metodo !== 'pix') continue;
      if (seguraSlot(a)) continue; // ainda dentro da janela → mantém
      if (Number(a.credito_usado ?? 0) > 0) {
        const u = await getUsuarioById(usuarioId);
        if (u) {
          u.credito_saldo = Math.round((Number(u.credito_saldo ?? 0) + Number(a.credito_usado)) * 100) / 100;
          await updateUsuario(u);
        }
        a.credito_usado = null;
      }
      a.status = 'cancelado';
      a.cancelado_motivo = 'pix_expirado';
      await updateAgendamento(a);
    }
  } catch { /* best-effort */ }
}
