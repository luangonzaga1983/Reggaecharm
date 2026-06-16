import { NextRequest, NextResponse } from 'next/server';
import {
  getAllAgendamentos, getStoreConfig, getAllBarbeiros, updateAgendamento,
} from '@/lib/discord';
import { pushToUsuario } from '@/lib/push';
import { constantTimeEqual } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Avisa quando faltar ~1h30 (90 min). Janela larga (60–105 min) tolera cron a cada
// 15 min; flag `aviso_corte` garante 1 envio só por corte.
const ALVO_MIN = 90;
const JANELA_MIN_ANTES = 105; // não avisa cedo demais
const JANELA_MIN_DEPOIS = 60; // nem tarde demais

/**
 * GET /api/cron/proximos — idealmente a cada 15 min (Vercel Cron / pinger externo).
 * Protegido por CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Fail-closed em produção (ver cron/lembretes).
  if (process.env.NODE_ENV === 'production' && !secret) {
    return new NextResponse('cron not configured', { status: 503 });
  }
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    if (!constantTimeEqual(auth, `Bearer ${secret}`)) return new NextResponse('forbidden', { status: 403 });
  }

  try {
    const [ags, cfg, barbeiros] = await Promise.all([getAllAgendamentos(), getStoreConfig(), getAllBarbeiros()]);
    const barNome = (id: string) => barbeiros.find(b => b.id === id)?.nome ?? 'seu barbeiro';
    const now = Date.now();
    let enviados = 0;

    for (const a of ags) {
      if (a.status === 'cancelado') continue;
      if (a.aviso_corte) continue;
      if ((a.presenca ?? 'pendente') !== 'pendente') continue;
      const inicio = new Date(`${a.data}T${a.horario}:00`).getTime();
      if (!Number.isFinite(inicio)) continue;
      const minutos = Math.round((inicio - now) / 60000);
      if (minutos > JANELA_MIN_ANTES || minutos < JANELA_MIN_DEPOIS) continue;

      await pushToUsuario(a.usuario_id, {
        title: `Falta pouco — ${cfg.nome_loja}`,
        body: `Seu ${a.servico} com ${barNome(a.barbeiro_id)} é às ${a.horario} (em ~${minutos} min). Já tá chegando?`,
        tag: `aviso-${a.id}`,
      });
      try { a.aviso_corte = true; await updateAgendamento(a); } catch { /* ignore */ }
      enviados++;
    }

    return NextResponse.json({ ok: true, alvo_min: ALVO_MIN, enviados });
  } catch (e) {
    console.error('[cron proximos]', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
