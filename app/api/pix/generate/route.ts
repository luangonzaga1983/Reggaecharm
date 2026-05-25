import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { ok, err, unauth, notFound, serverErr } from '@/lib/api';
import { audit } from '@/lib/audit';
import { clientIp } from '@/lib/security';
import { generatePix } from '@/lib/sigilo';
import {
  getAgendamentoById, getUsuarioById, updateAgendamento,
  createPixTransaction,
} from '@/lib/discord';
import { sanitizeString } from '@/validators';
import type { PixPurpose } from '@/types';

/**
 * POST /api/pix/generate
 * Body: { purpose: 'agendamento' | 'multa', agendamento_id?: string }
 *
 * - 'agendamento': gera PIX para um agendamento pendente do próprio usuário.
 * - 'multa': gera PIX para quitar a multa pendente do próprio usuário.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauth();

  const ip = clientIp(req);
  const ua = req.headers.get('user-agent') || undefined;

  try {
    const raw = await req.text();
    if (raw.length > 2_000) return err('Payload muito grande');
    const body = raw ? JSON.parse(raw) : null;
    if (!body || typeof body !== 'object') return err('Payload inválido');

    const purpose = body.purpose as PixPurpose;
    if (purpose !== 'agendamento' && purpose !== 'multa') return err('purpose inválido');

    const usuario = await getUsuarioById(session.id);
    if (!usuario) return notFound();

    if (purpose === 'agendamento') {
      const agId = sanitizeString(body.agendamento_id, 64);
      if (!agId) return err('agendamento_id obrigatório');
      const ag = await getAgendamentoById(agId);
      if (!ag) return notFound();
      if (ag.usuario_id !== session.id) return err('Agendamento não pertence ao usuário', 403);
      if (ag.pago) return err('Agendamento já pago', 409);
      if (ag.status === 'cancelado') return err('Agendamento cancelado', 409);
      if (!ag.valor || ag.valor < 1) return err('Valor inválido para cobrança');

      const pix = await generatePix({
        amount: ag.valor,
        description: `Agendamento ${ag.servico} — ${ag.data} ${ag.horario}`,
        metadata: { agendamento_id: ag.id, usuario_id: usuario.id, purpose },
      });

      ag.pix_tx_id = pix.transactionId;
      ag.pix_identifier = pix.identifier;
      ag.pix_status = 'PENDING';
      ag.pago = false;
      await updateAgendamento(ag);

      await createPixTransaction({
        id: pix.transactionId,
        identifier: pix.identifier,
        usuario_id: usuario.id,
        purpose: 'agendamento',
        agendamento_id: ag.id,
        amount: pix.amount,
        status: 'PENDING',
        qr_code_text: pix.qrCodeText,
        qr_code_base64: pix.qrCodeBase64,
        created_at: new Date().toISOString(),
        expires_at: pix.expiresAt,
      });

      audit({
        ts: '', actor_id: session.id, actor_role: session.role,
        action: 'config_change',
        meta: { entity: 'pix_tx', op: 'generate', purpose, ag_id: ag.id, amount: pix.amount, tx: pix.transactionId },
        ip, ua,
      });

      return ok({
        transactionId: pix.transactionId,
        qrCodeBase64: pix.qrCodeBase64,
        qrCodeText:   pix.qrCodeText,
        amount: pix.amount,
        status: pix.status,
        expiresAt: pix.expiresAt,
      });
    }

    // purpose === 'multa'
    const valor = Number(usuario.multa_pendente ?? 0);
    if (valor < 1) return err('Sem multa pendente');
    const pix = await generatePix({
      amount: valor,
      description: `Multa por não comparecimento`,
      metadata: { usuario_id: usuario.id, purpose },
    });

    await createPixTransaction({
      id: pix.transactionId,
      identifier: pix.identifier,
      usuario_id: usuario.id,
      purpose: 'multa',
      agendamento_id: null,
      amount: pix.amount,
      status: 'PENDING',
      qr_code_text: pix.qrCodeText,
      qr_code_base64: pix.qrCodeBase64,
      created_at: new Date().toISOString(),
      expires_at: pix.expiresAt,
    });

    audit({
      ts: '', actor_id: session.id, actor_role: session.role,
      action: 'config_change',
      meta: { entity: 'pix_tx', op: 'generate', purpose, amount: pix.amount, tx: pix.transactionId },
      ip, ua,
    });

    return ok({
      transactionId: pix.transactionId,
      qrCodeBase64: pix.qrCodeBase64,
      qrCodeText:   pix.qrCodeText,
      amount: pix.amount,
      status: pix.status,
      expiresAt: pix.expiresAt,
    });
  } catch (e) {
    console.error('[pix/generate]', e);
    return serverErr();
  }
}
