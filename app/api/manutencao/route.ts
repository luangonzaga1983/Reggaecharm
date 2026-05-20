import { NextRequest, NextResponse } from 'next/server';
import { getMaintenanceConfig, saveMaintenanceConfig } from '@/lib/discord';
import { getSession } from '@/lib/auth';
import { ok, unauth, forbidden, serverErr } from '@/lib/api';

export async function GET() {
  return NextResponse.json({ maintenance: await getMaintenanceConfig() });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauth();
  if (session.role !== 'dono') return forbidden();

  try {
    const body = await req.json().catch(() => ({}));
    const current = await getMaintenanceConfig();
    const updated = await saveMaintenanceConfig({
      ...current,
      ...(body.ativo    !== undefined && { ativo:    !!body.ativo }),
      ...(body.mensagem !== undefined && { mensagem: String(body.mensagem).slice(0, 500) }),
    });
    return ok({ maintenance: updated });
  } catch {
    return serverErr();
  }
}
