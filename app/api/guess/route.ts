import { NextResponse } from 'next/server';

import { getIstDate, validateGameDate } from '../../../lib/date';
import { getGameSalt, selectDailyMovie } from '../../../lib/daily';
import { BASE_GUESSES, buildSnapshot, evaluateGuess } from '../../../lib/engine';
import { toBootstrap } from '../../../lib/game';
import { fetchEligibleMovies, fetchMovieByWikidataId } from '../../../lib/repository';
import type { ClueCategory, GuessRequest, GuessResult, Movie } from '../../../lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function historyIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return [];
  const ids = value.map((item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object' && 'wikidataId' in item && typeof item.wikidataId === 'string') return item.wikidataId;
    return null;
  });
  return ids.every((id): id is string => Boolean(id && id.length <= 100)) ? ids : null;
}

const clueCategories: ClueCategory[] = ['genres', 'cast', 'directors', 'production', 'music', 'writers'];
function selectedLifelines(value: unknown): ClueCategory[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 2) return null;
  const selected = value.filter((item): item is ClueCategory => typeof item === 'string' && clueCategories.includes(item as ClueCategory));
  return selected.length === value.length && new Set(selected).size === selected.length ? selected : null;
}

async function fetchHistory(ids: string[]): Promise<Movie[] | null> {
  const movies = await Promise.all(ids.map((id) => fetchMovieByWikidataId(id)));
  return movies.every((movie): movie is Movie => movie !== null) ? movies : null;
}

export async function POST(request: Request): Promise<Response> {
  let body: GuessRequest;
  try {
    body = await request.json() as GuessRequest;
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  if (!body || typeof body !== 'object') return json({ error: 'request body must be an object' }, 400);

  const validation = validateGameDate(body.date ?? getIstDate());
  if (!validation.ok) return json({ error: validation.error }, 400);
  const ids = historyIds(body.guesses ?? body.guessedIds);
  if (!ids || ids.length > 10 || new Set(ids).size !== ids.length) return json({ error: 'invalid guess history' }, 400);
  const lifelines = selectedLifelines(body.selectedLifelines);
  if (!lifelines) return json({ error: 'invalid lifeline selection' }, 400);
  const lifelineSlotsAvailable = ids.length >= 6 ? 2 : ids.length >= 4 ? 1 : 0;
  if (lifelines.length > lifelineSlotsAvailable) return json({ error: 'lifeline is not unlocked yet' }, 400);

  const wantsExtra = Boolean(body.extraGuesses || body.useExtraGuesses);
  if (wantsExtra && ids.length < BASE_GUESSES) {
    return json({ error: 'extra guesses are not available' }, 400);
  }
  if (body.action === 'state' || body.action === 'lifeline') {
    if (body.action === 'lifeline' && lifelines.length === 0) {
      return json({ error: 'select a lifeline category' }, 400);
    }
    try {
      const answer = selectDailyMovie(await fetchEligibleMovies(), validation.date, getGameSalt());
      const history = await fetchHistory(ids);
      if (!history) return json({ error: 'one or more guesses were not found' }, 400);
      const guesses = history.map((movie, index) => evaluateGuess(answer, movie, index + 1));
      const snapshot = buildSnapshot({
        date: validation.date,
        answer,
        guesses,
        extraGuesses: wantsExtra,
        selectedLifelines: lifelines,
      });
      return json(toBootstrap(snapshot, validation.archive));
    } catch {
      return json({ error: 'game state is temporarily unavailable' }, 503);
    }
  }

  if (body.action === 'extra') {
    if (ids.length < BASE_GUESSES || wantsExtra) return json({ error: 'extra guesses are not available' }, 400);
    try {
      const answer = selectDailyMovie(await fetchEligibleMovies(), validation.date, getGameSalt());
      const history = await fetchHistory(ids);
      if (!history) return json({ error: 'one or more guesses were not found' }, 400);
      const guesses = history.map((movie, index) => evaluateGuess(answer, movie, index + 1));
      const snapshot = buildSnapshot({ date: validation.date, answer, guesses, extraGuesses: true, selectedLifelines: lifelines });
      return json(toBootstrap(snapshot, validation.archive));
    } catch {
      return json({ error: 'guess is temporarily unavailable' }, 503);
    }
  }

  const guessId = typeof body.guessId === 'string' ? body.guessId : body.guess;
  if (typeof guessId !== 'string' || !guessId.trim() || guessId.length > 100) return json({ error: 'guessId is required' }, 400);
  if (ids.includes(guessId)) return json({ error: 'movie already guessed' }, 400);
  if (ids.length >= BASE_GUESSES && !wantsExtra) return json({ error: 'use the extra guesses option first' }, 409);
  if (ids.length >= BASE_GUESSES + 3) return json({ error: 'no guesses remaining' }, 409);

  try {
    const answer = selectDailyMovie(await fetchEligibleMovies(), validation.date, getGameSalt());
    const history = await fetchHistory(ids);
    const guess = await fetchMovieByWikidataId(guessId.trim());
    if (!history || !guess || guess.eligible === false) return json({ error: 'movie was not found' }, 400);
    const guesses: GuessResult[] = history.map((movie, index) => evaluateGuess(answer, movie, index + 1));
    guesses.push(evaluateGuess(answer, guess, guesses.length + 1));
    const snapshot = buildSnapshot({ date: validation.date, answer, guesses, extraGuesses: wantsExtra, selectedLifelines: lifelines });
    return json(toBootstrap(snapshot, validation.archive));
  } catch {
    return json({ error: 'guess is temporarily unavailable' }, 503);
  }
}
