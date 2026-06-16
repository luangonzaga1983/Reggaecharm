import { NextRequest, NextResponse } from 'next/server';
import {
  getAllUsuarios, getAllAgendamentos, getStoreConfig, updateUsuario, getAllBarbeiros,
} from '@/lib/discord';
import { pushToUsuario } from '@/lib/push';
import { constantTimeEqual } from '@/lib/security';
import { LEMBRETE_CORTE_DIAS } from '@/utils';
import { hojeSP, dataSP } from '@/lib/datetime';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/lembretes — disparado pelo Vercel Cron (1x/dia).
 * Protegido por CRON_SECRET (Vercel injeta `Authorization: Bearer <CRON_SECRET>`).
 * - Lembra clientes com corte AMANHÃ.
 * - Avisa "tá na hora" quem cortou há LEMBRETE_CORTE_DIAS+ dias e não tem agendamento futuro
 *   (no máx 1x a cada LEMBRETE_CORTE_DIAS dias, via campo ultimo_lembrete).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Fail-closed em produção: sem CRON_SECRET configurado, o endpoint NÃO roda
  // (evita cron mutador aberto à internet). Em dev, segue sem secret p/ testar.
  if (process.env.NODE_ENV === 'production' && !secret) {
    return new NextResponse('cron not configured', { status: 503 });
  }
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    if (!constantTimeEqual(auth, `Bearer ${secret}`)) return new NextResponse('forbidden', { status: 403 });
  }

  try {
    const [users, ags, cfg, barbeiros] = await Promise.all([getAllUsuarios(), getAllAgendamentos(), getStoreConfig(), getAllBarbeiros()]);
    const title = cfg.nome_loja;
    const barNome = (id: string) => barbeiros.find(b => b.id === id)?.nome ?? 'seu barbeiro';
    const now = Date.now();
    const hoje = hojeSP();
    const amanha = dataSP(1);

    let lembretes = 0, naHora = 0;

    // 1) Lembrete de corte amanhã
    for (const a of ags.filter(a => a.data === amanha && a.status !== 'cancelado')) {
      await pushToUsuario(a.usuario_id, {
        title: `Lembrete — ${cfg.nome_loja}`,
        body: `Você tem ${a.servico} amanhã às ${a.horario} com ${barNome(a.barbeiro_id)}. Até lá!`,
        tag: `lembrete-${a.id}`,
      });
      lembretes++;
    }

    // 2) "Tá na hora de cortar"
    const ultimoCortePorUser = new Map<string, string>();
    const temFuturo = new Set<string>();
    for (const a of ags) {
      if (a.presenca === 'compareceu') {
        const prev = ultimoCortePorUser.get(a.usuario_id);
        if (!prev || a.data > prev) ultimoCortePorUser.set(a.usuario_id, a.data);
      }
      if (a.data >= hoje && a.status !== 'cancelado') temFuturo.add(a.usuario_id);
    }

    for (const u of users) {
      if (u.role !== 'cliente') continue;
      if (temFuturo.has(u.id)) continue;
      const ultimo = ultimoCortePorUser.get(u.id);
      if (!ultimo) continue;
      const dias = Math.floor((now - new Date(ultimo + 'T12:00').getTime()) / 86400000);
      if (dias < LEMBRETE_CORTE_DIAS) continue;
      // anti-spam: não reenviar antes de LEMBRETE_CORTE_DIAS dias
      if (u.ultimo_lembrete) {
        const desde = Math.floor((now - new Date(u.ultimo_lembrete).getTime()) / 86400000);
        if (desde < LEMBRETE_CORTE_DIAS) continue;
      }
      await pushToUsuario(u.id, {
        title: `Tá na hora de cortar!`,
        body: `Faz ${dias} dias do seu último corte na ${cfg.nome_loja}. Bora marcar? É rápido — abra o app e escolha seu horário.`,
        tag: 'na-hora',
      });
      try { u.ultimo_lembrete = new Date().toISOString(); await updateUsuario(u); } catch { /* ignore */ }
      naHora++;
    }

    return NextResponse.json({ ok: true, lembretes, naHora });
  } catch (e) {
    console.error('[cron lembretes]', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
