import type { JLPTLevel, KanjiProgress, KanjiSessionType, Session } from '../types';
import type { Curriculum } from './kanjiCurriculum';
import { getCurriculum, kanjiIn } from './kanjiCurriculum';

// ─── Kanji progress ─────────────────────────────────────
// Pure functions over the saved progress (storage.ts keeps it in localStorage).
// Picking the kanji for a session is done here, deterministically, with no AI call.

export type KanjiProgressMap = Record<string, KanjiProgress>;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Wait before a kanji comes back, by its streak after the answer. */
const REVIEW_INTERVALS = [4 * HOUR, 1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];

/** Right on the first try this many sessions in a row = mastered. */
export const KNOWN_STREAK = 3;

/** A kanji seen this recently is only used again when nothing else is left. */
const RECENT_MS = 4 * HOUR;

/** Words remembered per kanji, to vary the word used for it. */
const MAX_WORDS = 5;

export type KanjiStatus = 'new' | 'learning' | 'known';

export function kanjiStatus(p: KanjiProgress | undefined): KanjiStatus {
  if (!p) return 'new';
  return p.streak >= KNOWN_STREAK ? 'known' : 'learning';
}

export const isDue = (p: KanjiProgress | undefined, now: number) => !!p && p.dueAt <= now;

export interface KanjiAnswer {
  /** Answered right in the end */
  correct: boolean;
  /** Right on the first attempt, without looking at the answer */
  firstTry: boolean;
  word: string;
}

/** The progress after one question about `kanji` has been answered. */
export function recordKanjiResult(
  progress: KanjiProgressMap,
  kanji: string,
  level: JLPTLevel,
  answer: KanjiAnswer,
  now: number
): KanjiProgressMap {
  const prev = progress[kanji];
  // Right after a retry still counts as correct, but isn't mastery: the streak restarts
  const streak = answer.firstTry ? (prev?.streak ?? 0) + 1 : 0;
  const words = [...(prev?.words ?? []).filter((w) => w !== answer.word), answer.word].slice(-MAX_WORDS);
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
      dueAt: now + REVIEW_INTERVALS[Math.min(streak, REVIEW_INTERVALS.length - 1)],
      words,
    },
  };
}

const accuracy = (p: KanjiProgress) => (p.attempts > 0 ? p.correct / p.attempts : 0);

/**
 * The kanji for a session, best first.
 * new:    never practised (curriculum order) → due for review → still learning → mastered
 * review: due for review → still learning (weakest first) → mastered
 * Within that order, kanji seen in the last few hours go last, and nothing repeats.
 * Returns fewer than `count` only when the curriculum (or, for review, what has
 * been practised) is smaller.
 */
export function selectKanjiTargets(
  curriculum: Curriculum,
  progress: KanjiProgressMap,
  count: number,
  type: KanjiSessionType,
  now: number
): string[] {
  const seen = curriculum.kanji.map((k) => k.kanji).filter((k) => progress[k]);
  const p = (k: string) => progress[k];

  const fresh = curriculum.kanji.map((k) => k.kanji).filter((k) => !progress[k]);
  const due = seen
    .filter((k) => isDue(p(k), now))
    .sort((a, b) => p(a).dueAt - p(b).dueAt || p(b).incorrect - p(a).incorrect);
  const notDue = seen.filter((k) => !isDue(p(k), now));
  const learning = notDue.filter((k) => kanjiStatus(p(k)) === 'learning');
  const known = notDue
    .filter((k) => kanjiStatus(p(k)) === 'known')
    .sort((a, b) => p(a).lastSeenAt - p(b).lastSeenAt);

  const tiers = type === 'new'
    ? [fresh, due, [...learning].sort((a, b) => p(a).lastSeenAt - p(b).lastSeenAt), known]
    : [due, [...learning].sort((a, b) => accuracy(p(a)) - accuracy(p(b)) || p(a).lastSeenAt - p(b).lastSeenAt), known];

  const ordered = tiers.flat();
  const isRecent = (k: string) => !!p(k) && now - p(k).lastSeenAt < RECENT_MS;
  return [...ordered.filter((k) => !isRecent(k)), ...ordered.filter(isRecent)].slice(0, count);
}

export interface KanjiProgressSummary {
  total: number;
  /** Never practised */
  fresh: number;
  /** Practised at least once */
  studied: number;
  known: number;
  due: number;
}

export function summarizeKanjiProgress(curriculum: Curriculum, progress: KanjiProgressMap, now: number): KanjiProgressSummary {
  const entries = curriculum.kanji.map((k) => progress[k.kanji]);
  return {
    total: entries.length,
    fresh: entries.filter((p) => !p).length,
    studied: entries.filter((p) => p).length,
    known: entries.filter((p) => kanjiStatus(p) === 'known').length,
    due: entries.filter((p) => isDue(p, now)).length,
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
        word,
      }, at);
    }
  }
  return progress;
}
