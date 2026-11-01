import type { JLPTLevel, KanjiProgress, Session } from '../types';
import { getCurriculum, kanjiIn } from './kanjiCurriculum';

// ─── Kanji progress ─────────────────────────────────────
// Pure functions over the saved progress (storage.ts keeps it in localStorage).
// Progress comes from the Kanji page's reading practice (one result per finished
// practice); the JLPT Mock Test doesn't change it (user-requested).

export type KanjiProgressMap = Record<string, KanjiProgress>;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Wait before a kanji comes back, by its streak after the answer. */
const REVIEW_INTERVALS = [4 * HOUR, 1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];

/** This many good practices in a row = mastered. */
export const KNOWN_STREAK = 3;

/** Words remembered per kanji (shown on its card as the words practised). */
const MAX_WORDS = 5;

export type KanjiStatus = 'new' | 'learning' | 'known';

export function kanjiStatus(p: KanjiProgress | undefined): KanjiStatus {
  if (!p) return 'new';
  return p.streak >= KNOWN_STREAK ? 'known' : 'learning';
}

export const isDue = (p: KanjiProgress | undefined, now: number) => !!p && p.dueAt <= now;

export interface KanjiAnswer {
  /** Answered right in the end (a practice: a good practice) */
  correct: boolean;
  /** Right on the first attempt, without looking at the answer (a practice: a good practice) */
  firstTry: boolean;
  /** Words asked */
  words: string[];
}

/**
 * The progress after a practice (or, for old sessions, a question) about `kanji`.
 * Right → streak + 1, wrong → streak 0. Done right before the kanji is due again,
 * the streak and the review date stay: mastery needs the spaced reviews, not three
 * practices in a row on one evening.
 */
export function recordKanjiResult(
  progress: KanjiProgressMap,
  kanji: string,
  level: JLPTLevel,
  answer: KanjiAnswer,
  now: number
): KanjiProgressMap {
  const prev = progress[kanji];
  const early = answer.firstTry && !!prev && !isDue(prev, now);
  // Right after a retry still counts as correct, but isn't mastery: the streak restarts
  const streak = early ? prev.streak : answer.firstTry ? (prev?.streak ?? 0) + 1 : 0;
  const dueAt = early ? prev.dueAt : now + REVIEW_INTERVALS[Math.min(streak, REVIEW_INTERVALS.length - 1)];
  const words = [...(prev?.words ?? []).filter((w) => !answer.words.includes(w)), ...answer.words].slice(-MAX_WORDS);
  return {
    ...progress,
    [kanji]: {
      level,
      firstSeenAt: prev?.firstSeenAt ?? now,
      lastSeenAt: now,
      attempts: (prev?.attempts ?? 0) + 1,
      correct: (prev?.correct ?? 0) + (answer.correct ? 1 : 0),
      incorrect: (prev?.incorrect ?? 0) + (answer.correct ? 0 : 1),
      streak,
      dueAt,
      words,
    },
  };
}

/**
 * Progress rebuilt from kanji sessions saved before progress was tracked. Those
 * questions don't say which kanji they taught, so every kanji of the word that
 * belongs to the session's level counts.
 */
export function progressFromSessions(sessions: Session[]): KanjiProgressMap {
  let progress: KanjiProgressMap = {};
  const results = sessions
    .filter((s) => s.jlptSection === 'kanji' || s.appMode === 'kanji')
    .flatMap((s) => s.results.map((r) => ({ r, level: s.jlptLevel, at: r.attempts[0]?.timestamp ?? s.startedAt })))
    .filter(({ r }) => r.question.mode === 'kanji')
    .sort((a, b) => a.at - b.at);

  for (const { r, level, at } of results) {
    const levelKanji = new Set(getCurriculum(level).kanji.map((k) => k.kanji));
    const word = r.question.prompt;
    const targets = r.question.targetKanji ? [r.question.targetKanji] : kanjiIn(word).filter((k) => levelKanji.has(k));
    for (const kanji of targets) {
      progress = recordKanjiResult(progress, kanji, level, {
        correct: r.isCorrect,
        firstTry: !!r.attempts[0]?.isCorrect && !r.revealedAnswer,
        words: [word],
      }, at);
    }
  }
  return progress;
}

/** "in 3 hr" / "in 2 days", short enough for the kanji card's top line. */
export function fromNow(time: number, now: number, locale: string): string {
  const minutes = Math.max(1, Math.round((time - now) / 60000));
  const format = new Intl.RelativeTimeFormat(locale, { style: 'short', numeric: 'always' });
  if (minutes < 60) return format.format(minutes, 'minute');
  if (minutes < 36 * 60) return format.format(Math.round(minutes / 60), 'hour');
  return format.format(Math.round(minutes / 1440), 'day');
}
