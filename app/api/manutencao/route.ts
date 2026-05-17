import { NextRequest, NextResponse } from 'next/server';
import { getMaintenanceConfig, saveMaintenanceConfig } from '@/lib/discord';
import { getSession } from '@/lib/auth';

export async function GET() {
  const config = await getMaintenanceConfig();
  return NextResponse.json({ maintenance: config });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'dono') {
    return NextResponse.json({ error: 'Apenas o dono pode alterar a manutenção' }, { status: 403 });
  }
  const body = await req.json();
  const current = await getMaintenanceConfig();
  const updated = await saveMaintenanceConfig({
    ...current,
    ativo: body.ativo ?? current.ativo,
    mensagem: body.mensagem ?? current.mensagem,
  });
  return NextResponse.json({ ok: true, maintenance: updated });
}
