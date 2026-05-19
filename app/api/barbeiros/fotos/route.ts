import { NextRequest, NextResponse } from 'next/server';
import {
  getFotosByBarbeiro, createFotoBarbeiro, deleteFotoBarbeiro,
  getUsuarioById,
} from '@/lib/discord';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const barbeiroId = searchParams.get('barbeiro_id');
  if (!barbeiroId) return NextResponse.json({ error: 'barbeiro_id obrigatório' }, { status: 400 });
  try {
    const fotos = await getFotosByBarbeiro(barbeiroId);
    return NextResponse.json({ fotos });
  } catch (err) {
    console.error('[fotos GET]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const contentType = req.headers.get('content-type') || '';

  try {
    // ── Upload de nova foto ──────────────────────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const barbeiroId = form.get('barbeiro_id') as string;
      const descricao = (form.get('descricao') as string) || '';
      const file = form.get('foto') as File | null;

      if (!barbeiroId || !file) {
        return NextResponse.json({ error: 'barbeiro_id e foto são obrigatórios' }, { status: 400 });
      }

      // Verifica permissão: barbeiro só pode postar no próprio perfil; dono/gerente em qualquer um
      if (session.role === 'barbeiro') {
        const usuario = await getUsuarioById(session.id);
        if (usuario?.barbeiro_id !== barbeiroId) {
          return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
        }
      } else if (session.role === 'cliente') {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      }

      const buffer = await file.arrayBuffer();
      const foto = await createFotoBarbeiro(barbeiroId, descricao, buffer, file.name, file.type || 'image/jpeg');
      return NextResponse.json({ ok: true, foto });
    }

    // ── Deletar foto ─────────────────────────────────────────────────────────
    const body = await req.json();
    if (body.action === 'deletar') {
      const { message_id, barbeiro_id } = body;
      if (!message_id) return NextResponse.json({ error: 'message_id obrigatório' }, { status: 400 });

      // Verifica permissão
      if (session.role === 'barbeiro') {
        const usuario = await getUsuarioById(session.id);
        if (usuario?.barbeiro_id !== barbeiro_id) {
          return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
        }
      } else if (session.role === 'cliente') {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      }

      await deleteFotoBarbeiro(message_id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err) {
    console.error('[fotos POST]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
