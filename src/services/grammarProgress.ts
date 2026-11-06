import type { JLPTLevel } from '../types';
import type { GrammarPoint } from './grammar';
import type { ReviewState } from './review';
import { scheduleReview } from './review';

// ─── Grammar progress ───────────────────────────────────
// One result per finished grammar practice (Grammar page, "Practice this grammar"),
// spaced like the kanji reading practice. Saved in localStorage.sjp_grammar_progress.

export interface GrammarProgress extends ReviewState {
  level: JLPTLevel;
  firstSeenAt: number;
  lastSeenAt: number;
  /** Finished practices */
  attempts: number;
  /** Good practices */
  correct: number;
}

export type GrammarProgressMap = Record<string, GrammarProgress>;

/**
 * The key a point's progress is saved under: level + pattern, not the id (N4-12),
 * which changes when a point is inserted into the list.
 */
export const grammarKey = (point: GrammarPoint) => `${point.level}:${point.pattern}`;

export function recordGrammarResult(progress: GrammarProgressMap, point: GrammarPoint, good: boolean, now: number): GrammarProgressMap {
  const key = grammarKey(point);
  const prev = progress[key];
  return {
    ...progress,
    [key]: {
      level: point.level,
      firstSeenAt: prev?.firstSeenAt ?? now,
      lastSeenAt: now,
      attempts: (prev?.attempts ?? 0) + 1,
      correct: (prev?.correct ?? 0) + (good ? 1 : 0),
      ...scheduleReview(prev, good, now),
    },
  };
}
