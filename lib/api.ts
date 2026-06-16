import { NextResponse } from 'next/server';

export const ok   = (data?: object) => NextResponse.json({ ok: true, ...data });
export const err  = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });
export const unauth = () => err('Não autenticado', 401);
export const forbidden = () => err('Sem permissão', 403);
export const notFound = () => err('Não encontrado', 404);
export const serverErr = () => err('Erro interno', 500);
