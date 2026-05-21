import { NextRequest, NextResponse } from 'next/server';
import { getStoreConfig, saveStoreConfig } from '@/lib/discord';
import { getSession } from '@/lib/auth';
import { ok, err, unauth, forbidden, serverErr } from '@/lib/api';
import { sanitizeString } from '@/validators';

export async function GET() {
  try {
    return NextResponse.json({ config: await getStoreConfig() });
  } catch {
    return serverErr();
  }
}

// Cores permitidas (whitelist — segurança)
const CORES_VALIDAS = ['green', 'yellow', 'red', 'purple', 'blue', 'custom'] as const;
const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)              return unauth();
  if (session.role !== 'dono') return forbidden();

  try {
    const body = await req.json().catch(() => null);
    if (!body) return err('Payload inválido');

    const current = await getStoreConfig();

    // ── Validação das cores ──────────────────────────────────────────────────
    let tema_cor = current.tema_cor;
    if (body.tema_cor !== undefined) {
      if (!CORES_VALIDAS.includes(body.tema_cor)) return err('Cor inválida');
      tema_cor = body.tema_cor;
    }

    let tema_cor_custom = current.tema_cor_custom;
    if (body.tema_cor_custom !== undefined) {
      // Aceita apenas hex puro (#RRGGBB) ou undefined/null para limpar
      if (body.tema_cor_custom === null || body.tema_cor_custom === '') {
        tema_cor_custom = undefined;
      } else if (!HEX_REGEX.test(body.tema_cor_custom)) {
        return err('Cor personalizada inválida — use formato #RRGGBB');
      } else {
        tema_cor_custom = body.tema_cor_custom;
      }
    }

    const modo_reggae = typeof body.modo_reggae === 'boolean'
      ? body.modo_reggae
      : current.modo_reggae ?? false;

    const saved = await saveStoreConfig({
      ...current,
      ...(body.nome_loja !== undefined && {
        nome_loja: sanitizeString(body.nome_loja, 80) || current.nome_loja,
      }),
      ...(body.slogan !== undefined && {
        slogan: sanitizeString(body.slogan, 120),
      }),
      tema_cor,
      tema_cor_custom,
      modo_reggae,
      ...(body.unidades !== undefined && { unidades: body.unidades }),
      ...(body.servicos !== undefined && { servicos: body.servicos }),
    });

    return ok({ config: saved });
  } catch {
    return serverErr();
  }
}
