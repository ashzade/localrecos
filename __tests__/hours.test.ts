/**
 * Tests for lib/hours.ts — isOpenNow
 *
 * isOpenNow() uses the real clock (new Date()) internally.
 * We freeze time by spying on the global Date constructor so tests are deterministic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isOpenNow } from '@/lib/hours';

// Freeze time using Vitest's fake timer system.
// jsDay: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
// placesDay (Google): 0=Mon 1=Tue 2=Wed 3=Thu 4=Fri 5=Sat 6=Sun
function freezeTime(jsDay: number, hours: number, minutes: number) {
  // Start from a known Monday (2024-01-01 is a Monday, jsDay=1)
  const base = new Date('2024-01-01T00:00:00');
  const offset = (jsDay - 1 + 7) % 7; // days to add to reach jsDay from Monday
  base.setDate(base.getDate() + offset);
  base.setHours(hours, minutes, 0, 0);
  vi.setSystemTime(base);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Pipe-separated (Google Places weekday_text) format ────────────────────────

describe('pipe-separated format', () => {
  // placesDay index: Mon=0 Tue=1 Wed=2 Thu=3 Fri=4 Sat=5 Sun=6
  // jsDay: Sun=0 Mon=1 Tue=2 Wed=3 Thu=4 Fri=5 Sat=6
  // Wednesday jsDay=3 → placesDay=2

  const WED_OPEN = 'Monday: 9:00 AM – 10:00 PM | Tuesday: 9:00 AM – 10:00 PM | Wednesday: 9:00 AM – 10:00 PM | Thursday: 9:00 AM – 10:00 PM | Friday: 9:00 AM – 11:00 PM | Saturday: 10:00 AM – 11:00 PM | Sunday: 10:00 AM – 9:00 PM';

  it('returns true when current time is within open window', () => {
    freezeTime(3, 14, 30); // Wednesday 14:30
    expect(isOpenNow(WED_OPEN)).toBe(true);
  });

  it('returns false when current time is before opening', () => {
    freezeTime(3, 8, 0); // Wednesday 08:00 — before 9:00 AM open
    expect(isOpenNow(WED_OPEN)).toBe(false);
  });

  it('returns false when current time is after closing', () => {
    freezeTime(3, 22, 30); // Wednesday 22:30 — after 10:00 PM close
    expect(isOpenNow(WED_OPEN)).toBe(false);
  });

  it('returns false for Closed day', () => {
    const closedMon = 'Monday: Closed | Tuesday: 9:00 AM – 10:00 PM | Wednesday: 9:00 AM – 10:00 PM | Thursday: 9:00 AM – 10:00 PM | Friday: 9:00 AM – 10:00 PM | Saturday: 9:00 AM – 10:00 PM | Sunday: 9:00 AM – 10:00 PM';
    freezeTime(1, 12, 0); // Monday noon
    expect(isOpenNow(closedMon)).toBe(false);
  });

  it('returns true for 24 hours entry', () => {
    const open24 = 'Monday: Open 24 hours | Tuesday: Open 24 hours | Wednesday: Open 24 hours | Thursday: Open 24 hours | Friday: Open 24 hours | Saturday: Open 24 hours | Sunday: Open 24 hours';
    freezeTime(3, 3, 0); // Wednesday 3 AM
    expect(isOpenNow(open24)).toBe(true);
  });

  it('handles overnight hours (closes after midnight)', () => {
    // Closes at 2:00 AM next day
    const overnight = 'Monday: 9:00 AM – 10:00 PM | Tuesday: 9:00 AM – 10:00 PM | Wednesday: 10:00 PM – 2:00 AM | Thursday: 9:00 AM – 10:00 PM | Friday: 9:00 AM – 10:00 PM | Saturday: 9:00 AM – 10:00 PM | Sunday: 9:00 AM – 10:00 PM';
    freezeTime(3, 23, 0); // Wednesday 11 PM — within overnight window
    expect(isOpenNow(overnight)).toBe(true);
    freezeTime(3, 2, 30); // Wednesday 2:30 AM — past close
    expect(isOpenNow(overnight)).toBe(false);
  });

  it('handles 24-hour clock format', () => {
    const fmt24 = 'Monday: 09:00 – 22:00 | Tuesday: 09:00 – 22:00 | Wednesday: 09:00 – 22:00 | Thursday: 09:00 – 22:00 | Friday: 09:00 – 22:00 | Saturday: 09:00 – 22:00 | Sunday: 09:00 – 22:00';
    freezeTime(3, 11, 0); // Wednesday 11:00 — open
    expect(isOpenNow(fmt24)).toBe(true);
    freezeTime(3, 22, 1); // Wednesday 22:01 — closed
    expect(isOpenNow(fmt24)).toBe(false);
  });

  it('returns null for unparseable segment', () => {
    const bad = 'Monday: varies | Tuesday: varies | Wednesday: varies | Thursday: varies | Friday: varies | Saturday: varies | Sunday: varies';
    freezeTime(3, 12, 0);
    expect(isOpenNow(bad)).toBeNull();
  });
});

// ── Compact format ────────────────────────────────────────────────────────────

describe('compact format', () => {
  it('returns true when open (full week range)', () => {
    freezeTime(3, 14, 0); // Wednesday 14:00
    expect(isOpenNow('Mon-Sun 11am–10pm')).toBe(true);
  });

  it('returns false when before opening', () => {
    freezeTime(3, 9, 0); // Wednesday 09:00 — before 11am
    expect(isOpenNow('Mon-Sun 11am–10pm')).toBe(false);
  });

  it('returns false when after closing', () => {
    freezeTime(3, 22, 30); // Wednesday 22:30 — after 10pm
    expect(isOpenNow('Mon-Sun 11am–10pm')).toBe(false);
  });

  it('handles weekday/weekend split schedule', () => {
    const split = 'Mon-Fri 7am–4pm, Sat-Sun 8am–3pm';
    freezeTime(3, 10, 0); // Wednesday 10:00 — weekday open
    expect(isOpenNow(split)).toBe(true);
    freezeTime(6, 10, 0); // Saturday 10:00 — weekend open
    expect(isOpenNow(split)).toBe(true);
    freezeTime(6, 17, 0); // Saturday 17:00 — weekend closed
    expect(isOpenNow(split)).toBe(false);
  });

  it('returns null when today is not in any segment', () => {
    freezeTime(3, 12, 0); // Wednesday
    expect(isOpenNow('Mon-Tue 9am–5pm')).toBeNull();
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('returns null for empty string', () => {
    freezeTime(3, 12, 0);
    expect(isOpenNow('')).toBeNull();
  });

  it('returns null for gibberish', () => {
    freezeTime(3, 12, 0);
    expect(isOpenNow('not valid hours at all')).toBeNull();
  });

  it('handles Sunday correctly (jsDay 0 → placesDay 6)', () => {
    const hours = 'Monday: Closed | Tuesday: Closed | Wednesday: Closed | Thursday: Closed | Friday: Closed | Saturday: Closed | Sunday: 10:00 AM – 8:00 PM';
    freezeTime(0, 14, 0); // Sunday 14:00
    expect(isOpenNow(hours)).toBe(true);
    freezeTime(1, 14, 0); // Monday 14:00 — Closed
    expect(isOpenNow(hours)).toBe(false);
  });
});
