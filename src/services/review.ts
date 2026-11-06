// ─── Spaced review ──────────────────────────────────────
// Shared by the kanji reading practice and the grammar practice: one good practice
// (enough right on the first try) moves an item one step up, a bad one starts it again.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Wait before an item comes back, by its streak after the practice. */
export const REVIEW_INTERVALS = [4 * HOUR, 1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];

/** This many good practices in a row = mastered. */
export const KNOWN_STREAK = 3;

/** A practice is good with at least this share right on the first try (4 of 5). */
export const PRACTICE_PASS_RATE = 0.8;

export type ReviewStatus = 'new' | 'learning' | 'known';

export interface ReviewState {
  streak: number;
  dueAt: number;
}

export function reviewStatus(p: ReviewState | undefined): ReviewStatus {
  if (!p) return 'new';
  return p.streak >= KNOWN_STREAK ? 'known' : 'learning';
}

export const isDue = (p: ReviewState | undefined, now: number) => !!p && p.dueAt <= now;

/**
 * The streak and review date after a practice. Good → streak + 1, bad → 0. A good
 * practice before the item is due keeps both: mastery needs the spaced reviews, not
 * three practices in a row on one evening.
 */
export function scheduleReview(prev: ReviewState | undefined, good: boolean, now: number): ReviewState {
  if (good && prev && !isDue(prev, now)) return { streak: prev.streak, dueAt: prev.dueAt };
  const streak = good ? (prev?.streak ?? 0) + 1 : 0;
  return { streak, dueAt: now + REVIEW_INTERVALS[Math.min(streak, REVIEW_INTERVALS.length - 1)] };
}

/** "in 3 hr" / "in 2 days", short enough for a card's top line. */
export function fromNow(time: number, now: number, locale: string): string {
  const minutes = Math.max(1, Math.round((time - now) / 60000));
  const format = new Intl.RelativeTimeFormat(locale, { style: 'short', numeric: 'always' });
  if (minutes < 60) return format.format(minutes, 'minute');
  if (minutes < 36 * 60) return format.format(Math.round(minutes / 60), 'hour');
  return format.format(Math.round(minutes / 1440), 'day');
}
