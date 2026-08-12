import type { Movie, MovieSearchResult, RawMovieRecord } from './types';
import { movieFromRecord, publicMovie } from './daily';
import { getSupabaseAdmin } from './supabaseAdmin';
import localMovieRecords from '../data/movies.json';

const MOVIES_TABLE = 'movies';

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function localCatalog(): Movie[] {
  return (localMovieRecords as RawMovieRecord[])
    .map(movieFromRecord)
    .filter((movie): movie is Movie => movie !== null);
}

function repositoryError(error: { message?: string } | null): Error | null {
  return error ? new Error(error.message || 'movie repository error') : null;
}

export async function fetchMovies(): Promise<Movie[]> {
  if (!hasSupabaseConfig()) return localCatalog();
  const { data, error } = await getSupabaseAdmin().from(MOVIES_TABLE).select('*');
  const failure = repositoryError(error);
  if (failure) throw failure;
  return (data as RawMovieRecord[] | null ?? [])
    .map(movieFromRecord)
    .filter((movie): movie is Movie => movie !== null);
}

export async function fetchEligibleMovies(): Promise<Movie[]> {
  const movies = await fetchMovies();
  return movies.filter((movie) => movie.eligible !== false);
}

export async function fetchMovieByWikidataId(wikidataId: string): Promise<Movie | null> {
  if (!hasSupabaseConfig()) return localCatalog().find((movie) => movie.wikidataId === wikidataId) ?? null;
  const { data, error } = await getSupabaseAdmin()
    .from(MOVIES_TABLE)
    .select('*')
    .eq('wikidata_id', wikidataId)
    .maybeSingle();
  const failure = repositoryError(error);
  if (failure) throw failure;
  return data ? movieFromRecord(data as RawMovieRecord) : null;
}

export async function searchMovies(query: string, limit = 8): Promise<MovieSearchResult[]> {
  const safeLimit = Math.min(20, Math.max(1, Math.floor(limit)));
  const term = query.trim();
  if (!term) return [];
  if (!hasSupabaseConfig()) {
    const loweredTerm = term.toLocaleLowerCase('en-US');
    return localCatalog()
      .filter((movie) => movie.eligible !== false && movie.title.toLocaleLowerCase('en-US').includes(loweredTerm))
      .slice(0, safeLimit)
      .map(publicMovie);
  }
  const { data, error } = await getSupabaseAdmin()
    .from(MOVIES_TABLE)
    .select('*')
    .ilike('title', `%${term.replace(/[%_]/g, (match) => `\\${match}`)}%`)
    .limit(safeLimit);
  const failure = repositoryError(error);
  if (failure) throw failure;
  return (data as RawMovieRecord[] | null ?? [])
    .map(movieFromRecord)
    .filter((movie): movie is Movie => movie !== null && movie.eligible !== false)
    .slice(0, safeLimit)
    .map(publicMovie);
}

// Short aliases keep route code readable and are useful for alternate adapters.
export const searchMovieRepository = searchMovies;
export const getMovieById = fetchMovieByWikidataId;
