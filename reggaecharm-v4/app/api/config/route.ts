import { NextRequest, NextResponse } from 'next/server';
import { getStoreConfig, saveStoreConfig } from '@/lib/discord';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const config = await getStoreConfig();
    return NextResponse.json({ config });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (session.role !== 'dono') return NextResponse.json({ error: 'Apenas o dono pode alterar as configurações da loja' }, { status: 403 });

  try {
    const body = await req.json();
    const currentConfig = await getStoreConfig();

    // Merge parcial — dono pode mudar só o que quiser
    const updated = {
      ...currentConfig,
      ...body,
      // Garante que campos críticos não virem undefined
      nome_loja: body.nome_loja?.trim() || currentConfig.nome_loja,
      slogan: body.slogan !== undefined ? body.slogan : currentConfig.slogan,
      tema_cor: body.tema_cor || currentConfig.tema_cor,
      unidades: body.unidades || currentConfig.unidades,
      servicos: body.servicos || currentConfig.servicos,
    };

    const saved = await saveStoreConfig(updated);
    return NextResponse.json({ ok: true, config: saved });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
