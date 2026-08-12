import { NextResponse } from 'next/server';

import { searchMovies } from '../../../lib/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const query = params.get('q')?.trim() ?? '';
  const limitValue = params.get('limit');
  const limit = limitValue === null ? 8 : Number(limitValue);
  if (query.length < 2 || query.length > 100) return json({ error: 'q must be 2-100 characters' }, 400);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) return json({ error: 'limit must be 1-20' }, 400);
  try {
    return json({ results: await searchMovies(query, limit) });
  } catch {
    return json({ error: 'search is temporarily unavailable' }, 503);
  }
}

