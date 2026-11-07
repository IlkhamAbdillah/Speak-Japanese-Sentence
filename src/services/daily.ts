import type { DailyPlan, JLPTLevel } from '../types';
import { JLPT_LEVELS } from '../types';
import type { KanjiEntry } from './kanjiList';
import { KANJI_LIST } from './kanjiList';
import { practiceWordsFor } from './kanjiPractice';
import type { KanjiProgressMap } from './kanjiProgress';
import type { GrammarPoint } from './grammar';
import { GRAMMAR_POINTS } from './grammar';
import type { GrammarProgressMap } from './grammarProgress';
import { grammarKey } from './grammarProgress';
import type { ReviewState } from './review';
import { isDue, reviewStatus } from './review';
import { todayKey } from './storage';

// ─── Daily Learning ─────────────────────────────────────
// One set of exercises a day (user-requested), so the learner doesn't pick menus:
// the reading practice of DAILY_KANJI kanji (5 words each), the grammar practice of
// DAILY_GRAMMAR points (5 sentences each, AI) and DAILY_PARTICLES particle sentences
// (AI). The kanji and grammar parts count for their progress like the practices on
// their cards. The picks are kept for the day (localStorage.sjp_daily).

export const DAILY_KANJI = 5;
export const DAILY_GRAMMAR = 5;
export const DAILY_PARTICLES = 5;

/**
 * When no mastered item is due, the last slot goes to a random mastered one with this
 * chance, so mastered items still come back now and then between their reviews.
 */
export const MASTERED_SURPRISE_CHANCE = 0.25;


interface Candidate<T> {
  item: T;
  /** Position in the list: level (N5 first), then teaching order */
  order: number;
  state?: ReviewState;
}

/**
 * Today's items, earlier levels first so they get mastered before the next ones start
 * (user-requested):
 *   1. due for review (learning or mastered), lowest level first, then longest overdue
 *   2. new items, in the list's order (N5 → N1, teaching order)
 *   3. if still short (everything started): learning items not due yet, soonest first,
 *      then mastered ones, soonest first
 * A mastered item comes back when its review is due (7 → 30 days), and now and then
 * before that (MASTERED_SURPRISE_CHANCE). `usable` is only checked for the items looked
 * at (it can be slow, e.g. the kanji's practice words).
 */
export function pickDailyItems<T>(
  items: T[],
  stateOf: (item: T) => ReviewState | undefined,
  usable: (item: T) => boolean,
  count: number,
  now: number,
  random: () => number = Math.random
): T[] {
  const due: Candidate<T>[] = [];
  const fresh: Candidate<T>[] = [];
  const waiting: Candidate<T>[] = [];
  const mastered: Candidate<T>[] = [];
  items.forEach((item, order) => {
    const state = stateOf(item);
    const c = { item, order, state };
    if (!state) fresh.push(c);
    else if (isDue(state, now)) due.push(c);
    else if (reviewStatus(state) === 'known') mastered.push(c);
    else waiting.push(c);
  });
  // `order` already sorts by level (the lists go N5 → N1)
  due.sort((a, b) => a.order - b.order || a.state!.dueAt - b.state!.dueAt);
  waiting.sort((a, b) => a.state!.dueAt - b.state!.dueAt);
  mastered.sort((a, b) => a.state!.dueAt - b.state!.dueAt);

  const picked: Candidate<T>[] = [];
  for (const c of [...due, ...fresh, ...waiting, ...mastered]) {
    if (picked.length >= count) break;
    if (usable(c.item)) picked.push(c);
  }

  // Now and then a mastered item before its review
  const hasMastered = picked.some((c) => reviewStatus(c.state) === 'known');
  if (!hasMastered && picked.length === count && mastered.length > 0 && random() < MASTERED_SURPRISE_CHANCE) {
    const pool = mastered.filter((c) => !picked.includes(c));
    for (let tries = 0; tries < 10 && pool.length > 0; tries++) {
      const c = pool.splice(Math.floor(random() * pool.length), 1)[0];
      if (usable(c.item)) {
        picked[picked.length - 1] = c;
        break;
      }
    }
  }
  return picked.map((c) => c.item);
}

const KANJI_BY_CHAR = new Map(KANJI_LIST.map((e) => [e.kanji, e]));
const GRAMMAR_BY_KEY = new Map(GRAMMAR_POINTS.map((p) => [grammarKey(p), p]));

export const dailyKanji = (plan: DailyPlan): KanjiEntry[] => plan.kanji.flatMap((k) => KANJI_BY_CHAR.get(k) ?? []);
export const dailyGrammar = (plan: DailyPlan): GrammarPoint[] => plan.grammar.flatMap((k) => GRAMMAR_BY_KEY.get(k) ?? []);
export const kanjiByChar = (kanji: string) => KANJI_BY_CHAR.get(kanji);
export const grammarByKey = (key: string) => GRAMMAR_BY_KEY.get(key);

const levelIndex = (level: JLPTLevel) => JLPT_LEVELS.indexOf(level);

/** A new plan for today from the saved progress. */
export function buildDailyPlan(kanjiProgress: KanjiProgressMap, grammarProgress: GrammarProgressMap, now = Date.now()): DailyPlan {
  const kanji = pickDailyItems(
    KANJI_LIST,
    (e) => kanjiProgress[e.kanji],
    (e) => practiceWordsFor(e).length > 0,
    DAILY_KANJI,
    now
  );
  const grammar = pickDailyItems(
    GRAMMAR_POINTS,
    (p) => grammarProgress[grammarKey(p)],
    () => true,
    DAILY_GRAMMAR,
    now
  );
  // Particle sentences at the level the learner is working on: the easiest of today's grammar
  const particleLevel = grammar.reduce<JLPTLevel>(
    (lowest, p) => (levelIndex(p.level) < levelIndex(lowest) ? p.level : lowest),
    grammar[0]?.level ?? 'N5'
  );
  return {
    date: todayKey(new Date(now)),
    kanji: kanji.map((e) => e.kanji),
    grammar: grammar.map(grammarKey),
    particleLevel,
    done: {},
  };
}
