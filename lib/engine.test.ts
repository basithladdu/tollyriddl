import { describe, expect, it } from 'vitest';

import { buildSnapshot, evaluateGuess, sharedClues, unlockedLifelines, yearClue } from './engine';
import type { Movie } from './types';

const answer: Movie = {
  wikidataId: 'Q2', title: 'Answer', year: 2010,
  genres: ['Drama'], cast: ['Star'], directors: ['Director'], production: ['Studio'], music: ['Composer'], writers: ['Writer'],
};
const wrong: Movie = {
  wikidataId: 'Q1', title: 'Wrong', year: 2011,
  genres: ['drama'], cast: ['Other'], directors: ['Other director'], production: ['Studio'], music: [], writers: [],
};

describe('TollyRiddl clue engine', () => {
  it('reports shared metadata case-insensitively', () => {
    expect(sharedClues(wrong, answer)).toEqual([{ category: 'genres', values: ['Drama'] }, { category: 'production', values: ['Studio'] }]);
  });

  it('narrows the year window after incorrect guesses', () => {
    expect(yearClue(2010, [evaluateGuess(answer, { ...wrong, year: 2008 }, 1)])).toEqual({ from: 2008, to: 2026, exact: false, direction: 'after' });
    expect(yearClue(2010, [evaluateGuess(answer, { ...wrong, year: 2012 }, 1)])).toEqual({ from: 2000, to: 2012, exact: false, direction: 'before' });
    expect(yearClue(2010, [evaluateGuess(answer, { ...wrong, year: 2010 }, 1)])).toEqual({ from: 2010, to: 2010, exact: true, direction: 'same' });
  });

  it('unlocks lifelines at guesses four and six', () => {
    expect(unlockedLifelines(answer, 3)).toHaveLength(0);
    expect(unlockedLifelines(answer, 4, ['genres']).map((item) => item.unlockedAt)).toEqual([4]);
    expect(unlockedLifelines(answer, 6, ['genres', 'cast']).map((item) => item.unlockedAt)).toEqual([4, 6]);
  });

  it('reveals the answer only after a win or final loss', () => {
    const first = evaluateGuess(answer, wrong, 1);
    const playing = buildSnapshot({ date: '2026-08-11', answer, guesses: [first] });
    expect(playing.answer).toBeUndefined();
    const won = buildSnapshot({ date: '2026-08-11', answer, guesses: [first, evaluateGuess(answer, answer, 2)] });
    expect(won.answer?.wikidataId).toBe('Q2');
    const seven = Array.from({ length: 7 }, (_, index) => evaluateGuess(answer, { ...wrong, wikidataId: `Q${index + 10}` }, index + 1));
    expect(buildSnapshot({ date: '2026-08-11', answer, guesses: seven }).complete).toBe(false);
    const ten = Array.from({ length: 10 }, (_, index) => evaluateGuess(answer, { ...wrong, wikidataId: `Q${index + 20}` }, index + 1));
    expect(buildSnapshot({ date: '2026-08-11', answer, guesses: ten, extraGuesses: true }).answer?.wikidataId).toBe('Q2');
  });
});
