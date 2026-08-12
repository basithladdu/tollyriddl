import { describe, expect, it } from 'vitest';

import { getIstDate, isValidGameDate, validateGameDate } from './date';

describe('IST game dates', () => {
  it('uses IST at the UTC day boundary', () => {
    expect(getIstDate(new Date('2026-08-10T18:29:59.000Z'))).toBe('2026-08-10');
    expect(getIstDate(new Date('2026-08-10T18:30:00.000Z'))).toBe('2026-08-11');
  });

  it('accepts archive dates and rejects future dates', () => {
    const now = new Date('2026-08-10T18:30:00.000Z');
    expect(validateGameDate('2026-08-10', now)).toEqual({ ok: true, date: '2026-08-10', archive: true });
    expect(validateGameDate('2026-08-12', now)).toEqual({ ok: false, error: 'future dates are not available' });
    expect(isValidGameDate('2026-02-29', now)).toBe(false);
  });
});

