import { NextRequest, NextResponse } from 'next/server';
import { getStoreConfig, saveStoreConfig, invalidateConfigCache } from '@/lib/discord';
import { getSession } from '@/lib/auth';
import { ok, err, unauth, forbidden, serverErr } from '@/lib/api';
import { auditFromSession } from '@/lib/audit';
import { clientIp } from '@/lib/security';
import { sanitizeString, validateTemaCor, validateHex, validateUnidades, validateServicos, isBool } from '@/validators';

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
    const raw = await req.text();
    if (raw.length > 200_000) return err('Payload muito grande');
    const body = raw ? JSON.parse(raw) : null;
    if (!body || typeof body !== 'object') return err('Payload inválido');

    const current = await getStoreConfig();

    const patch: Record<string, unknown> = {};

    if (body.nome_loja !== undefined) {
      const n = sanitizeString(body.nome_loja, 80);
      if (!n) return err('Nome da loja inválido');
      patch.nome_loja = n;
    }
    if (body.slogan !== undefined) patch.slogan = sanitizeString(body.slogan, 120);

    if (body.tema_cor !== undefined) {
      const t = validateTemaCor(body.tema_cor);
      if (!t) return err('Cor inválida');
      patch.tema_cor = t;
    }

    if (body.tema_cor_custom !== undefined) {
      if (body.tema_cor_custom === null || body.tema_cor_custom === '') {
        patch.tema_cor_custom = undefined;
      } else {
        const h = validateHex(body.tema_cor_custom);
        if (!h) return err('Cor personalizada inválida (use #RRGGBB)');
        patch.tema_cor_custom = h;
      }
    }

    if (body.modo_reggae !== undefined) patch.modo_reggae = !!body.modo_reggae;

    if (body.unidades !== undefined) {
      const u = validateUnidades(body.unidades);
      if (!u) return err('Lista de unidades inválida');
      patch.unidades = u;
    }

    if (body.servicos !== undefined) {
      const s = validateServicos(body.servicos);
      if (!s) return err('Lista de serviços inválida');
      patch.servicos = s;
    }

    if (body.comissoes !== undefined) {
      if (body.comissoes === null || typeof body.comissoes !== 'object' || Array.isArray(body.comissoes)) {
        return err('Comissões inválidas');
      }
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(body.comissoes as Record<string, unknown>)) {
        const id = sanitizeString(k, 64);
        const pct = Number(v);
        if (!id || !Number.isFinite(pct) || pct < 0 || pct > 100) return err('Comissão inválida (0–100)');
        out[id] = Math.round(pct * 100) / 100;
      }
      patch.comissoes = out;
    }

    const saved = await saveStoreConfig({ ...current, ...patch });
    auditFromSession(session, 'config_change', {
      meta: { entity: 'store_config', fields: Object.keys(patch) },
      ip: clientIp(req),
      ua: req.headers.get('user-agent') || undefined,
    });
    return ok({ config: saved });
  } catch (e) {
    console.error('[config POST]', e);
    invalidateConfigCache();
    return serverErr();
  }
}
