export type ClueCategory =
  | 'genres'
  | 'cast'
  | 'directors'
  | 'production'
  | 'music'
  | 'writers';

export interface Movie {
  wikidataId: string;
  title: string;
  year: number;
  genres: string[];
  cast: string[];
  directors: string[];
  production: string[];
  music: string[];
  writers: string[];
  eligible?: boolean;
}

export interface MovieSearchResult {
  wikidataId: string;
  title: string;
  year: number;
}

export interface YearClue {
  from: number;
  to: number;
  exact: boolean;
  direction?: 'after' | 'before' | 'same';
}

export interface SharedClue {
  category: ClueCategory;
  values: string[];
}

export interface Lifeline {
  category: ClueCategory;
  values: string[];
  unlockedAt: 4 | 6;
}

export interface LifelineSlot {
  unlockedAt: 4 | 6;
  categories: ClueCategory[];
}

export interface GuessResult {
  wikidataId: string;
  title: string;
  year: number;
  correct: boolean;
  attempt: number;
  shared: SharedClue[];
}

export interface GameSnapshot {
  date: string;
  guesses: GuessResult[];
  guessesUsed: number;
  maxGuesses: number;
  remainingGuesses: number;
  extraGuesses: boolean;
  won: boolean;
  complete: boolean;
  yearClue: YearClue | null;
  lifelines: Lifeline[];
  lifelineSlots: LifelineSlot[];
  answer?: MovieSearchResult & Partial<Movie>;
}

export interface GameBootstrap extends Omit<GameSnapshot, 'guesses' | 'won' | 'complete' | 'answer'> {
  product: 'TollyRiddl';
  archive: boolean;
  status: 'playing' | 'won' | 'lost';
  guesses: GuessResult[];
  won: boolean;
  complete: boolean;
}

export interface GuessRequest {
  date?: string;
  guess?: string;
  guessId?: string;
  guesses?: string[];
  guessedIds?: string[];
  extraGuesses?: boolean;
  useExtraGuesses?: boolean;
  selectedLifelines?: ClueCategory[];
  action?: 'guess' | 'extra' | 'state' | 'lifeline';
}

export interface RawMovieRecord {
  wikidata_id?: string;
  wikidataId?: string;
  qid?: string;
  title?: string;
  release_year?: number;
  releaseYear?: number;
  year?: number;
  genres?: unknown;
  cast?: unknown;
  principal_cast?: unknown;
  principalCast?: unknown;
  directors?: unknown;
  production?: unknown;
  production_companies?: unknown;
  productionCompanies?: unknown;
  music?: unknown;
  music_directors?: unknown;
  musicDirectors?: unknown;
  writers?: unknown;
  eligible?: boolean;
  is_eligible?: boolean;
}
