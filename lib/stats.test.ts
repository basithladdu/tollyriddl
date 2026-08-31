import { describe, expect, it } from 'vitest';

import { emptyStats, formatShareResult, recordCompletedRound, summarizeStats } from './stats';

describe('TollyRiddl stats', () => {
  it('tracks a current and maximum win streak', () => {
    const stats = {
      ...emptyStats,
      playedDates: ['2026-08-10', '2026-08-11', '2026-08-12'],
      wonDates: ['2026-08-10', '2026-08-11', '2026-08-12'],
      guessCounts: { '2026-08-10': 4, '2026-08-11': 2, '2026-08-12': 3 },
      best: 2,
    };
    expect(summarizeStats(stats, '2026-08-12')).toMatchObject({ played: 3, wins: 3, winRate: 100, currentStreak: 3, maxStreak: 3, best: 2 });
    expect(summarizeStats(stats, '2026-08-13').currentStreak).toBe(3);
  });

  it('creates spoiler-free share text with a fixed result grid', () => {
    expect(formatShareResult({ date: '2026-08-12', guesses: [{ correct: false }, { correct: true }], maxGuesses: 7, solved: true })).toBe('TollyRiddl · 2026-08-12 · 2/7\n\n🟥\n🟩\n⬜\n⬜\n⬜\n⬜\n⬜');
  });

  it('does not count a loaded or unfinished round as played', () => {
    const loaded = recordCompletedRound(emptyStats, '2026-08-12', {
      complete: false,
      solved: false,
      guessCount: 0,
    });
    const inProgress = recordCompletedRound(loaded, '2026-08-12', {
      complete: false,
      solved: false,
      guessCount: 4,
    });

    expect(inProgress).toEqual(emptyStats);
  });

  it('records completed wins and losses without treating a loss as a win', () => {
    const loss = recordCompletedRound(emptyStats, '2026-08-11', {
      complete: true,
      solved: false,
      guessCount: 10,
    });
    const win = recordCompletedRound(loss, '2026-08-12', {
      complete: true,
      solved: true,
      guessCount: 3,
    });

    expect(win).toEqual({
      playedDates: ['2026-08-11', '2026-08-12'],
      wonDates: ['2026-08-12'],
      guessCounts: { '2026-08-12': 3 },
      best: 3,
    });
  });
});
