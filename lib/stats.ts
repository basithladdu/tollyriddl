export type StoredStats = {
  playedDates: string[];
  wonDates: string[];
  guessCounts: Record<string, number>;
  best: number | null;
};

export type StatsSummary = {
  played: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  best: number | null;
  distribution: number[];
};

export const emptyStats: StoredStats = {
  playedDates: [],
  wonDates: [],
  guessCounts: {},
  best: null,
};

function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function previousDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export function normalizeStats(value: unknown): StoredStats {
  if (!value || typeof value !== 'object') return { ...emptyStats, guessCounts: {} };
  const record = value as Record<string, unknown>;
  const playedDates = Array.isArray(record.playedDates) ? record.playedDates.filter(isDate) : [];
  const wonDates = Array.isArray(record.wonDates) ? record.wonDates.filter(isDate) : [];
  const rawCounts = record.guessCounts && typeof record.guessCounts === 'object' ? record.guessCounts as Record<string, unknown> : {};
  const guessCounts = Object.fromEntries(
    Object.entries(rawCounts).filter(([date, count]) => isDate(date) && Number.isInteger(count) && Number(count) > 0 && Number(count) <= 10).map(([date, count]) => [date, Number(count)]),
  );
  const best = Number.isInteger(record.best) && Number(record.best) > 0 && Number(record.best) <= 10 ? Number(record.best) : null;
  return {
    playedDates: Array.from(new Set(playedDates)).sort(),
    wonDates: Array.from(new Set(wonDates)).sort(),
    guessCounts,
    best,
  };
}

export function recordCompletedRound(
  stats: unknown,
  date: string,
  round: { complete: boolean; solved: boolean; guessCount: number },
): StoredStats {
  const current = normalizeStats(stats);
  if (
    !round.complete ||
    !isDate(date) ||
    !Number.isInteger(round.guessCount) ||
    round.guessCount < 1 ||
    round.guessCount > 10
  ) {
    return current;
  }

  const playedDates = current.playedDates.includes(date)
    ? current.playedDates
    : [...current.playedDates, date];
  const wonDates = round.solved && !current.wonDates.includes(date)
    ? [...current.wonDates, date]
    : current.wonDates;
  const guessCounts = round.solved
    ? { ...current.guessCounts, [date]: round.guessCount }
    : current.guessCounts;
  const recordedWins = Object.values(guessCounts);
  const best = recordedWins.length ? Math.min(...recordedWins) : current.best;

  return normalizeStats({ playedDates, wonDates, guessCounts, best });
}

function streakEndingAt(wonDates: Set<string>, anchor: string): number {
  let streak = 0;
  let cursor = anchor;
  while (wonDates.has(cursor)) {
    streak += 1;
    cursor = previousDate(cursor);
  }
  return streak;
}

export function summarizeStats(stats: StoredStats, today: string): StatsSummary {
  const normalized = normalizeStats(stats);
  const wonDates = new Set(normalized.wonDates);
  const currentAnchor = wonDates.has(today) ? today : previousDate(today);
  const currentStreak = streakEndingAt(wonDates, currentAnchor);
  const maxStreak = normalized.wonDates.reduce((max, date) => Math.max(max, streakEndingAt(wonDates, date)), 0);
  const distribution = Array.from({ length: 10 }, (_, index) => Object.values(normalized.guessCounts).filter((count) => count === index + 1).length);
  return {
    played: normalized.playedDates.length,
    wins: normalized.wonDates.length,
    winRate: normalized.playedDates.length ? Math.round((normalized.wonDates.length / normalized.playedDates.length) * 100) : 0,
    currentStreak,
    maxStreak,
    best: normalized.best,
    distribution,
  };
}

export function formatShareResult({ date, guesses, maxGuesses, solved }: { date: string; guesses: Array<{ correct: boolean }>; maxGuesses: number; solved: boolean }): string {
  const rows: string[] = guesses.map((guess) => (guess.correct ? '🟩' : '🟥'));
  const remaining = Math.max(maxGuesses - rows.length, 0);
  if (remaining) rows.push(...Array.from({ length: remaining }, () => '⬜'));
  return [`TollyRiddl · ${date} · ${solved ? `${guesses.length}/${maxGuesses}` : `X/${maxGuesses}`}`, '', rows.join('\n')].join('\n');
}
