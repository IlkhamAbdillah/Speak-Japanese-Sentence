import similar from '../data/kanji/similar.json';
import type { KanjiQuizType, UserSettings } from '../types';
import type { KanjiEntry } from './kanjiList';
import type { KanjiPracticeQuestion } from './kanjiPractice';
import { KANJI_LIST } from './kanjiList';
import { buildKanjiPractice, isWordRead, practiceWordsFor } from './kanjiPractice';
import type { KanjiProgressMap } from './kanjiProgress';
import { kanjiStatus } from './kanjiProgress';

// ─── Kanji quiz ─────────────────────────────────────────
// The Kanji page's quiz, built and checked here with no AI call (like the Words quiz).
// It doesn't change the kanji progress: that comes from a kanji's reading practice
// (services/kanjiPractice.ts), which runs in the same quiz screen.
//   readings: a random practice word of each kanji (say or type the kanji's reading)
//   similar:  a word's reading → pick its spelling among look-alike kanji (時間 / 持間 / 待間 / 特間)

export const SIMILAR_SOURCE = similar.source;

export interface KanjiQuestion {
  entry: KanjiEntry;
  /** word: say or type the kanji's reading in `practice`'s word; similar: pick the kanji */
  type: 'word' | 'similar';
  practice: KanjiPracticeQuestion;
  /** similar: the answer and its look-alikes, shuffled */
  choices?: KanjiEntry[];
}

/** At most this many look-alikes are offered with the answer */
const SIMILAR_CHOICES = 3;
/** Look-alikes drawn from this many of the closest, so a kanji's question changes */
const SIMILAR_POOL = 5;

const KANJI_BY_CHAR = new Map(KANJI_LIST.map((e) => [e.kanji, e]));
const SIMILAR = similar.kanji as Record<string, string>;

/** A kanji's look-alikes, closest first (see src/data/kanji/README.md). */
export const lookAlikesOf = (e: KanjiEntry): KanjiEntry[] =>
  [...(SIMILAR[e.kanji] ?? '')].flatMap((k) => KANJI_BY_CHAR.get(k) ?? []);

/** Two look-alikes at least, or the question is a coin toss */
const hasLookAlikes = (e: KanjiEntry) => lookAlikesOf(e).length >= 2;

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

type QuizFilters = Pick<UserSettings, 'kanjiQuizJlpt' | 'kanjiQuizStatus' | 'kanjiQuizType'>;

/** The kanji the quiz may ask: any picked level and any picked status (none picked = all) that the type can ask. */
export function applyKanjiQuizFilters(f: QuizFilters, progress: KanjiProgressMap): KanjiEntry[] {
  return KANJI_LIST.filter((e) =>
    (f.kanjiQuizJlpt.length === 0 || f.kanjiQuizJlpt.includes(e.level)) &&
    (f.kanjiQuizStatus.length === 0 || f.kanjiQuizStatus.includes(kanjiStatus(progress[e.kanji]))) &&
    practiceWordsFor(e).length > 0 &&
    (f.kanjiQuizType !== 'similar' || hasLookAlikes(e)));
}

/** The word written with `other` in place of the question's kanji: 時間 → 持間. */
export const spellWith = (q: KanjiPracticeQuestion, other: KanjiEntry) =>
  q.word.written.split(q.entry.kanji).join(other.kanji);

/** A wrong spelling that is a real word with the same reading would also be right */
const isAlsoRight = (q: KanjiPracticeQuestion, other: KanjiEntry) => isWordRead(spellWith(q, other), q.said);

function similarChoices(entry: KanjiEntry, q: KanjiPracticeQuestion): KanjiEntry[] {
  // Not a kanji the word already has (右 in 左右: no 左左)
  const candidates = lookAlikesOf(entry).filter((o) => !q.word.written.includes(o.kanji) && !isAlsoRight(q, o));
  return shuffle([entry, ...shuffle(candidates.slice(0, SIMILAR_POOL)).slice(0, SIMILAR_CHOICES)]);
}

/** A quiz over `entries` in random order; count 0 = all of them. */
export function buildKanjiQuiz(entries: KanjiEntry[], type: KanjiQuizType, count: number): KanjiQuestion[] {
  const picked = shuffle(entries).slice(0, count > 0 ? count : entries.length);
  return picked.flatMap((entry): KanjiQuestion[] => {
    const [practice] = buildKanjiPractice(entry, 1);
    if (!practice) return [];
    if (type === 'readings') return [{ entry, type: 'word', practice }];
    const choices = similarChoices(entry, practice);
    return choices.length > 2 ? [{ entry, type: 'similar', practice, choices }] : [];
  });
}
