import { NextRequest, NextResponse } from 'next/server';
import { getMaintenanceConfig, saveMaintenanceConfig } from '@/lib/discord';
import { getLiveSession } from '@/lib/auth';
import { ok, err, unauth, forbidden, serverErr } from '@/lib/api';
import { auditFromSession } from '@/lib/audit';
import { clientIp } from '@/lib/security';
import { sanitizeString } from '@/validators';

export async function GET() {
  try {
    return NextResponse.json({ maintenance: await getMaintenanceConfig() });
  } catch {
    return serverErr();
  }
}

export async function POST(req: NextRequest) {
  const session = await getLiveSession();
  if (!session) return unauth();
  if (session.role !== 'dono') return forbidden();

  try {
    const raw = await req.text();
    if (raw.length > 4_000) return err('Payload muito grande');
    const body = raw ? JSON.parse(raw) : {};
    const current = await getMaintenanceConfig();
    const updated = await saveMaintenanceConfig({
      ...current,
      ...(body.ativo    !== undefined && { ativo: !!body.ativo }),
      ...(body.mensagem !== undefined && { mensagem: sanitizeString(body.mensagem, 500) }),
    });
    if (body.ativo !== undefined && updated.ativo !== current.ativo) {
      auditFromSession(session, 'maintenance_toggle', {
        meta: { from: current.ativo, to: updated.ativo },
        ip: clientIp(req),
        ua: req.headers.get('user-agent') || undefined,
      });
    }
    return ok({ maintenance: updated });
  } catch (e) {
    console.error('[manutencao POST]', e);
    return serverErr();
  }
}
