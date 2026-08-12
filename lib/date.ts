const IST_TIME_ZONE = 'Asia/Kolkata';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function partsForDate(value: Date): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: IST_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
}

/** The calendar date used by the game, always in Indian Standard Time. */
export function getIstDate(now: Date = new Date()): string {
  const parts = partsForDate(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Historical dates are supported as archives; future IST dates are not. */
export function isValidGameDate(value: unknown, now: Date = new Date()): value is string {
  return isCalendarDate(value) && value <= getIstDate(now);
}

export function validateGameDate(
  value: unknown,
  now: Date = new Date(),
): { ok: true; date: string; archive: boolean } | { ok: false; error: string } {
  if (!isCalendarDate(value)) return { ok: false, error: 'date must be YYYY-MM-DD' };
  const today = getIstDate(now);
  if (value > today) return { ok: false, error: 'future dates are not available' };
  return { ok: true, date: value, archive: value !== today };
}

// These aliases make the date contract easy to consume from route handlers and tests.
export const istDate = getIstDate;
export const isValidDate = isValidGameDate;

