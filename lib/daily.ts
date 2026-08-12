import { createHmac } from 'node:crypto';

import type { Movie, MovieSearchResult, RawMovieRecord } from './types';

const LOCAL_GAME_SALT = 'tollyriddl-development-only';

export function getGameSalt(): string {
  return process.env.GAME_SALT || (process.env.NODE_ENV === 'development' ? LOCAL_GAME_SALT : '');
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

export function movieFromRecord(record: RawMovieRecord): Movie | null {
  const wikidataId = record.wikidata_id ?? record.wikidataId ?? record.qid;
  const year = record.release_year ?? record.releaseYear ?? record.year;
  if (typeof wikidataId !== 'string' || !wikidataId || typeof record.title !== 'string' || !record.title.trim() || typeof year !== 'number' || !Number.isInteger(year)) {
    return null;
  }
  return {
    wikidataId,
    title: record.title.trim(),
    year,
    genres: stringList(record.genres),
    cast: stringList(record.cast ?? record.principal_cast ?? record.principalCast),
    directors: stringList(record.directors),
    production: stringList(record.production ?? record.production_companies ?? record.productionCompanies),
    music: stringList(record.music ?? record.music_directors ?? record.musicDirectors),
    writers: stringList(record.writers),
    eligible: record.eligible ?? record.is_eligible,
  };
}

export function eligibleMovies(movies: readonly Movie[]): Movie[] {
  return movies
    .filter((movie) => movie.eligible !== false)
    .filter((movie) => movie.wikidataId && movie.title && Number.isInteger(movie.year))
    .sort((a, b) => a.wikidataId.localeCompare(b.wikidataId));
}

/** Selects the archive answer from the stable Wikidata-ID ordering. */
export function selectDailyMovie(
  movies: readonly Movie[],
  date: string,
  gameSalt: string,
): Movie {
  const candidates = eligibleMovies(movies);
  if (!candidates.length) throw new Error('no eligible movies');
  if (!gameSalt) throw new Error('GAME_SALT is not configured');
  const digest = createHmac('sha256', gameSalt).update(date, 'utf8').digest();
  const index = digest.readUInt32BE(0) % candidates.length;
  return candidates[index];
}

export function selectDailyAnswer(movies: readonly Movie[], date: string, gameSalt = getGameSalt()): Movie {
  return selectDailyMovie(movies, date, gameSalt);
}

export function publicMovie(movie: Movie): MovieSearchResult {
  return { wikidataId: movie.wikidataId, title: movie.title, year: movie.year };
}
