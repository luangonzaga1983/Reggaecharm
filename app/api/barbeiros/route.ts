import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllBarbeiros,
  getBarbeiroById,
  createBarbeiro,
  updateBarbeiro,
  deleteBarbeiro,
  uploadBarberPhoto,
  BarbeiroDB,
} from '@/lib/discord';
import { getSession, canDo } from '@/lib/auth';

// GET /api/barbeiros — lista todos ou busca um
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  try {
    if (id) {
      const b = await getBarbeiroById(id);
      if (!b) return NextResponse.json({ error: 'Barbeiro não encontrado' }, { status: 404 });
      return NextResponse.json({ barbeiro: b });
    }
    const barbeiros = await getAllBarbeiros();
    return NextResponse.json({ barbeiros: barbeiros.filter(b => b.ativo) });
  } catch (err) {
    console.error('[barbeiros GET]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST /api/barbeiros — criar, editar, deletar, upload de foto
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!canDo(session.role, 'acesso_admin')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const contentType = req.headers.get('content-type') || '';

  try {
    // ── Upload de foto (multipart) ──────────────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const barbeiroId = form.get('barbeiro_id') as string;
      const file = form.get('foto') as File | null;

      if (!barbeiroId || !file) {
        return NextResponse.json({ error: 'barbeiro_id e foto são obrigatórios' }, { status: 400 });
      }

      const barbeiro = await getBarbeiroById(barbeiroId);
      if (!barbeiro || !barbeiro._messageId) {
        return NextResponse.json({ error: 'Barbeiro não encontrado' }, { status: 404 });
      }

      const buffer = await file.arrayBuffer();
      const freshUrl = await uploadBarberPhoto(
        barbeiro._messageId,
        barbeiro,
        buffer,
        file.name,
        file.type || 'image/jpeg',
      );

      return NextResponse.json({ ok: true, photo_url: freshUrl });
    }

    // ── JSON actions ────────────────────────────────────────────────────────
    const body = await req.json();
    const { action } = body;

    if (action === 'criar') {
      const { nome, especialidades, unidades, emoji } = body;
      if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });

      const novo: Omit<BarbeiroDB, '_messageId' | 'photo_url'> = {
        id: 'b' + uuidv4().replace(/-/g, '').slice(0, 8),
        nome: nome.trim(),
        especialidades: especialidades || [],
        unidades: unidades || [],
        emoji: emoji || '✂️',
        ativo: true,
        photo_message_id: null,
      };

      const criado = await createBarbeiro(novo);
      return NextResponse.json({ barbeiro: criado });
    }

    if (action === 'editar') {
      const { barbeiro_id, nome, especialidades, unidades, emoji, ativo } = body;
      const barbeiro = await getBarbeiroById(barbeiro_id);
      if (!barbeiro) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

      if (nome !== undefined) barbeiro.nome = nome.trim();
      if (especialidades !== undefined) barbeiro.especialidades = especialidades;
      if (unidades !== undefined) barbeiro.unidades = unidades;
      if (emoji !== undefined) barbeiro.emoji = emoji;
      if (ativo !== undefined) barbeiro.ativo = ativo;

      await updateBarbeiro(barbeiro);
      return NextResponse.json({ ok: true, barbeiro });
    }

    if (action === 'deletar') {
      const { barbeiro_id } = body;
      // Soft delete: marca como inativo (preserva histórico de agendamentos)
      const barbeiro = await getBarbeiroById(barbeiro_id);
      if (!barbeiro) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
      barbeiro.ativo = false;
      await updateBarbeiro(barbeiro);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err) {
    console.error('[barbeiros POST]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
