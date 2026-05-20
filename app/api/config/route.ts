import { NextRequest } from 'next/server';
import { getStoreConfig, saveStoreConfig } from '@/lib/discord';
import { getSession } from '@/lib/auth';
import { ok, err, unauth, forbidden, serverErr } from '@/lib/api';
import { sanitizeString } from '@/validators';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({ config: await getStoreConfig() });
  } catch {
    return serverErr();
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauth();
  if (session.role !== 'dono') return forbidden();

  try {
    const body = await req.json().catch(() => null);
    if (!body) return err('Payload inválido');

    const current = await getStoreConfig();
    const saved = await saveStoreConfig({
      ...current,
      ...(body.nome_loja   !== undefined && { nome_loja: sanitizeString(body.nome_loja, 80) || current.nome_loja }),
      ...(body.slogan      !== undefined && { slogan:    sanitizeString(body.slogan, 120) }),
      ...(body.tema_cor    !== undefined && { tema_cor:  body.tema_cor }),
      ...(body.unidades    !== undefined && { unidades:  body.unidades }),
      ...(body.servicos    !== undefined && { servicos:  body.servicos }),
    });
    return ok({ config: saved });
  } catch {
    return serverErr();
  }
}
