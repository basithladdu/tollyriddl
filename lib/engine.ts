import type {
  ClueCategory,
  GameSnapshot,
  GuessResult,
  Lifeline,
  LifelineSlot,
  Movie,
  SharedClue,
  YearClue,
} from './types';

export const BASE_GUESSES = 7;
export const EXTRA_GUESSES = 3;
export const MAX_GUESSES = BASE_GUESSES;

const CATEGORIES: ClueCategory[] = ['genres', 'cast', 'directors', 'production', 'music', 'writers'];
const CATEGORY_FIELDS: Record<ClueCategory, keyof Pick<Movie, 'genres' | 'cast' | 'directors' | 'production' | 'music' | 'writers'>> = {
  genres: 'genres',
  cast: 'cast',
  directors: 'directors',
  production: 'production',
  music: 'music',
  writers: 'writers',
};

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function intersection(guess: string[], answer: string[]): string[] {
  const answerValues = new Map(answer.map((value) => [normalized(value), value]));
  return guess
    .filter((value, index, values) => values.findIndex((item) => normalized(item) === normalized(value)) === index)
    .map((value) => answerValues.get(normalized(value)))
    .filter((value): value is string => Boolean(value));
}

export function sharedClues(guess: Movie, answer: Movie): SharedClue[] {
  return CATEGORIES.map((category) => ({
    category,
    values: intersection(guess[CATEGORY_FIELDS[category]], answer[CATEGORY_FIELDS[category]]),
  })).filter((clue) => clue.values.length > 0);
}

/** Narrow the range from the actual guessed years, rather than from guess count. */
export function yearClue(answerYear: number, guesses: readonly GuessResult[] | number): YearClue | null {
  if (typeof guesses === 'number') {
    if (guesses <= 0) return null;
    const spans = [20, 12, 7, 4, 2, 1, 0];
    const span = spans[Math.min(guesses, spans.length) - 1] ?? 0;
    return { from: answerYear - span, to: answerYear + span, exact: span === 0 };
  }
  const wrong = guesses.filter((guess) => !guess.correct);
  if (!wrong.length) return null;
  let from = 2000;
  let to = 2026;
  let direction: YearClue['direction'];
  for (const guess of wrong) {
    if (guess.year < answerYear) {
      from = Math.max(from, guess.year);
      direction = 'after';
    } else if (guess.year > answerYear) {
      to = Math.min(to, guess.year);
      direction = 'before';
    } else {
      from = answerYear;
      to = answerYear;
      direction = 'same';
    }
  }
  return { from, to, exact: from === to, direction };
}

export function availableLifelineCategories(answer: Movie): ClueCategory[] {
  return CATEGORIES.filter((category) => answer[CATEGORY_FIELDS[category]].length > 0);
}

/** Deterministic helper for clients that need a default option list; snapshots never auto-reveal it. */
export function selectLifelineCategory(answer: Movie, excluded: readonly ClueCategory[] = []): ClueCategory | null {
  return availableLifelineCategories(answer).find((category) => !excluded.includes(category)) ?? null;
}

export function lifelineSlots(answer: Movie, guessesUsed: number): LifelineSlot[] {
  const categories = availableLifelineCategories(answer);
  const slots: LifelineSlot[] = [];
  if (guessesUsed >= 4) slots.push({ unlockedAt: 4, categories: [...categories] });
  if (guessesUsed >= 6) slots.push({ unlockedAt: 6, categories: [...categories] });
  return slots;
}

export function unlockedLifelines(
  answer: Movie,
  guessesUsed: number,
  selected: readonly ClueCategory[] = [],
): Lifeline[] {
  const allowed = new Set(availableLifelineCategories(answer));
  const validSelected = selected.filter((category, index) => allowed.has(category) && selected.indexOf(category) === index).slice(0, guessesUsed >= 6 ? 2 : guessesUsed >= 4 ? 1 : 0);
  return validSelected.map((category, index) => ({
    category,
    values: [...answer[CATEGORY_FIELDS[category]]],
    unlockedAt: (index === 0 ? 4 : 6) as 4 | 6,
  }));
}

export function evaluateGuess(answer: Movie, guess: Movie, attempt: number): GuessResult {
  return {
    wikidataId: guess.wikidataId,
    title: guess.title,
    year: guess.year,
    correct: guess.wikidataId === answer.wikidataId,
    attempt,
    shared: sharedClues(guess, answer),
  };
}

export interface BuildSnapshotOptions {
  date: string;
  answer: Movie;
  guesses?: readonly GuessResult[];
  extraGuesses?: boolean;
  selectedLifelines?: readonly ClueCategory[];
}

export function buildSnapshot(options: BuildSnapshotOptions): GameSnapshot {
  const guesses = [...(options.guesses ?? [])];
  const extraGuesses = Boolean(options.extraGuesses);
  const maxGuesses = BASE_GUESSES + (extraGuesses ? EXTRA_GUESSES : 0);
  const won = guesses.some((guess) => guess.correct);
  // Guess seven unlocks the optional three-guess extension. Do not expose the
  // answer until the player wins or exhausts all ten attempts.
  const complete = won || (extraGuesses && guesses.length >= maxGuesses);
  const snapshot: GameSnapshot = {
    date: options.date,
    guesses,
    guessesUsed: guesses.length,
    maxGuesses,
    remainingGuesses: Math.max(0, maxGuesses - guesses.length),
    extraGuesses,
    won,
    complete,
    yearClue: yearClue(options.answer.year, guesses),
    lifelines: unlockedLifelines(options.answer, guesses.length, options.selectedLifelines),
    lifelineSlots: lifelineSlots(options.answer, guesses.length),
  };
  if (complete) snapshot.answer = { ...options.answer };
  return snapshot;
}

export function appendGuess(
  answer: Movie,
  guess: Movie,
  previous: readonly GuessResult[] = [],
  extraGuesses = false,
  date = '',
  selectedLifelines: readonly ClueCategory[] = [],
): GameSnapshot {
  return buildSnapshot({
    date,
    answer,
    guesses: [...previous, evaluateGuess(answer, guess, previous.length + 1)],
    extraGuesses,
    selectedLifelines,
  });
}

export const getSharedClues = sharedClues;
export const getYearNarrowing = yearClue;
export const getLifelines = unlockedLifelines;
export const createGameSnapshot = buildSnapshot;
