import type { JLPTLevel, KanjiProgress, Session } from '../types';
import { getCurriculum, kanjiIn } from './kanjiCurriculum';
import type { ReviewStatus } from './review';
import { fromNow, isDue, KNOWN_STREAK, reviewStatus, scheduleReview } from './review';

// ─── Kanji progress ─────────────────────────────────────
// Pure functions over the saved progress (storage.ts keeps it in localStorage).
// Progress comes from the Kanji page's reading practice (one result per finished
// practice); the JLPT Mock Test doesn't change it (user-requested).

export type KanjiProgressMap = Record<string, KanjiProgress>;

/** Words remembered per kanji (shown on its card as the words practised). */
const MAX_WORDS = 5;

export type KanjiStatus = ReviewStatus;
export const kanjiStatus = (p: KanjiProgress | undefined): KanjiStatus => reviewStatus(p);
export { fromNow, isDue, KNOWN_STREAK };

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
  // Right after a retry still counts as correct, but isn't mastery: the streak restarts
  const { streak, dueAt } = scheduleReview(prev, answer.firstTry, now);
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
