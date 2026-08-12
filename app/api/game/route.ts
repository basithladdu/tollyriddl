import { NextResponse } from 'next/server';

import { getIstDate, validateGameDate } from '../../../lib/date';
import { getGameSalt, selectDailyMovie } from '../../../lib/daily';
import { buildSnapshot } from '../../../lib/engine';
import { toBootstrap } from '../../../lib/game';
import { fetchEligibleMovies } from '../../../lib/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: Request): Promise<Response> {
  const requestedDate = new URL(request.url).searchParams.get('date') ?? getIstDate();
  const validation = validateGameDate(requestedDate);
  if (!validation.ok) return json({ error: validation.error }, 400);
  try {
    const answer = selectDailyMovie(await fetchEligibleMovies(), validation.date, getGameSalt());
    const snapshot = buildSnapshot({ date: validation.date, answer });
    return json(toBootstrap(snapshot, validation.archive));
  } catch {
    return json({ error: 'game is temporarily unavailable' }, 503);
  }
}
