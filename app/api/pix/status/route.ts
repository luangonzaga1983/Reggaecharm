import { NextRequest, NextResponse } from 'next/server';
import { getLiveSession } from '@/lib/auth';
import { err, unauth, notFound, serverErr } from '@/lib/api';
import { getPixStatus } from '@/lib/sigilo';
import { getPixTxById, updatePixTransaction, getAgendamentoById, updateAgendamento, getUsuarioById, updateUsuario } from '@/lib/discord';
import { sanitizeString } from '@/validators';
import type { PixStatus } from '@/types';

/**
 * GET /api/pix/status?tx=...
 *
 * Consulta status na SigiloPay. Se PAID e ainda não estava marcado,
 * atualiza agendamento/multa (idempotente). Usado como fallback ao webhook.
 */
export async function GET(req: NextRequest) {
  const session = await getLiveSession();
  if (!session) return unauth();

  try {
    const tx = sanitizeString(new URL(req.url).searchParams.get('tx'), 128);
    if (!tx) return err('tx obrigatório');

    const stored = await getPixTxById(tx);
    if (!stored) return notFound();
    if (stored.usuario_id !== session.id && session.role !== 'dono' && session.role !== 'gerente') {
      return err('Transação não pertence ao usuário', 403);
    }

    // Status já final? Retorna direto sem chamar SigiloPay
    if (stored.status === 'PAID' || stored.status === 'CANCELLED' || stored.status === 'EXPIRED' || stored.status === 'REFUNDED') {
      return NextResponse.json({ status: stored.status, amount: stored.amount, paidAt: stored.paid_at ?? null });
    }

    // Consultar gateway
    let remote: { status: PixStatus; amount: number; paidAt?: string };
    try {
      remote = await getPixStatus(tx) as any;
    } catch {
      return NextResponse.json({ status: stored.status, amount: stored.amount, paidAt: stored.paid_at ?? null });
    }

    if (remote.status === stored.status) {
      return NextResponse.json({ status: remote.status, amount: stored.amount, paidAt: remote.paidAt ?? null });
    }

    // Mudança de status: aplica efeitos colaterais
    stored.status = remote.status;
    if (remote.status === 'PAID') {
      stored.paid_at = remote.paidAt ?? new Date().toISOString();
      await applyPaidEffects(stored.purpose, stored.usuario_id, stored.agendamento_id ?? null, stored.amount, stored.paid_at);
    }
    await updatePixTransaction(stored);

    return NextResponse.json({ status: stored.status, amount: stored.amount, paidAt: stored.paid_at ?? null });
  } catch (e) {
    console.error('[pix/status]', e);
    return serverErr();
  }
}

async function applyPaidEffects(
  purpose: 'agendamento' | 'multa',
  usuarioId: string,
  agendamentoId: string | null,
  amount: number,
  paidAt: string,
): Promise<void> {
  if (purpose === 'agendamento' && agendamentoId) {
    const ag = await getAgendamentoById(agendamentoId);
    if (ag && !ag.pago) {
      ag.pago = true;
      ag.pix_status = 'PAID';
      ag.pago_em = paidAt;
      ag.status = 'confirmado';
      await updateAgendamento(ag);
    }
  } else if (purpose === 'multa') {
    const u = await getUsuarioById(usuarioId);
    if (u) {
      const atual = Number(u.multa_pendente ?? 0);
      u.multa_pendente = Math.max(0, atual - amount);
      await updateUsuario(u);
    }
  }
}
