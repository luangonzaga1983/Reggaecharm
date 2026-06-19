import { NextRequest, NextResponse } from 'next/server';
import { resolveAttachmentUrl } from '@/lib/discord';

export const dynamic = 'force-dynamic';

/**
 * GET /api/img?s=<usr|bar|foto>&m=<messageId>
 *
 * Proxy estável para fotos guardadas como anexo do Discord. As URLs de anexo do
 * Discord são assinadas e expiram (~24h), então servir o link cru ao browser faz
 * a imagem sumir. Esta rota resolve a URL fresca server-side e redireciona (302).
 *
 * Segurança: `s` só aceita escopos conhecidos (mapeiam para NOSSOS canais) e `m`
 * precisa ser um snowflake numérico — não há SSRF (nunca buscamos URL arbitrária).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('s') || '';
  const msgId = searchParams.get('m') || '';

  if (!/^(usr|bar|foto)$/.test(scope) || !/^\d{5,30}$/.test(msgId)) {
    return new NextResponse(null, { status: 400 });
  }

  const url = await resolveAttachmentUrl(scope, msgId);
  if (!url) return new NextResponse(null, { status: 404 });

  // 302 para a URL assinada atual. Cache curto no browser/CDN: evita reabrir a
  // mensagem no Discord a cada avatar, mas expira bem antes da assinatura (~24h).
  return NextResponse.redirect(url, {
    status: 302,
    headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=86400' },
  });
}
