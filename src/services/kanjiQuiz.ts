import type { KanjiQuizType, UserSettings } from '../types';
import type { KanjiEntry } from './kanjiList';
import type { KanjiPracticeQuestion } from './kanjiPractice';
import { examplesFor, KANJI_LIST, plainReading, splitKun, toKatakana } from './kanjiList';
import type { KanjiProgressMap } from './kanjiProgress';
import { kanjiStatus } from './kanjiProgress';
import { normalizeReading, stripKanjiTemplate } from './ai';

// ─── Kanji quiz ─────────────────────────────────────────
// The Kanji page's quiz, built and checked here with no AI call (like the Words quiz).
// It doesn't change the kanji progress: that comes from a kanji's reading practice
// (services/kanjiPractice.ts), which runs in the same quiz screen.

export type KanjiQuestionType = Exclude<KanjiQuizType, 'mixed'>;

export interface KanjiQuestion {
  entry: KanjiEntry;
  /** word: a reading practice question (say or type the kanji's reading in `practice`'s word) */
  type: KanjiQuestionType | 'word';
  /** Multiple choice (meaning / kanji / reading): the options, the answer among them */
  choices?: KanjiEntry[];
  practice?: KanjiPracticeQuestion;
}

const CHOICE_COUNT = 4;
const QUESTION_TYPES: KanjiQuestionType[] = ['meaning', 'kanji', 'reading', 'say'];

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

type QuizFilters = Pick<UserSettings, 'kanjiQuizJlpt' | 'kanjiQuizStatus'>;

/** The kanji the quiz may ask: any picked level and any picked status (none picked = all). */
export function applyKanjiQuizFilters(f: QuizFilters, progress: KanjiProgressMap): KanjiEntry[] {
  return KANJI_LIST.filter((e) =>
    (f.kanjiQuizJlpt.length === 0 || f.kanjiQuizJlpt.includes(e.level)) &&
    (f.kanjiQuizStatus.length === 0 || f.kanjiQuizStatus.includes(kanjiStatus(progress[e.kanji]))));
}

/** The meaning shown for a kanji in the quiz: its first two meanings. */
export const quizMeaning = (e: KanjiEntry) => e.meanings.slice(0, 2).join(', ');

// The kun'yomi shown for a kanji: one that a word of the Words lists uses (食 → たべる,
// not KANJIDIC's first, くう), else the first that isn't a prefix / suffix reading
const mainKunCache = new Map<string, string | undefined>();
function mainKun(e: KanjiEntry): string | undefined {
  if (!mainKunCache.has(e.kanji)) {
    const used = examplesFor(e, 20, e.kun.length).find((ex) => ex.reading && e.kun.includes(ex.reading))?.reading;
    mainKunCache.set(e.kanji, used ?? e.kun.find((r) => !r.startsWith('-') && !r.endsWith('-')) ?? e.kun[0]);
  }
  return mainKunCache.get(e.kanji);
}

/** Its main readings, as a choice: the first on'yomi (katakana) and the main kun'yomi (okurigana in brackets). */
export function quizReading(e: KanjiEntry): string {
  const kun = mainKun(e);
  const kunLabel = kun && (() => {
    const { stem, okurigana } = splitKun(kun);
    return okurigana ? `${stem}(${okurigana})` : stem;
  })();
  return [e.on[0] && toKatakana(e.on[0]), kunLabel].filter(Boolean).join('・');
}

/** Every reading of a kanji, as said (hiragana, no "." / "-" marks). */
const readingsOf = (e: KanjiEntry) => new Set([...e.on, ...e.kun].map((r) => normalizeReading(plainReading(r))));
const meaningsOf = (e: KanjiEntry) => new Set(e.meanings.map((m) => m.toLowerCase()));

/** Two kanji that could both answer the same question: a shared meaning, or a shared reading. */
function overlaps(a: KanjiEntry, b: KanjiEntry, type: KanjiQuestionType): boolean {
  if (a.kanji === b.kanji) return true;
  if (type === 'reading') {
    const ra = readingsOf(a);
    return [...readingsOf(b)].some((r) => ra.has(r)) || quizReading(a) === quizReading(b);
  }
  const ma = meaningsOf(a);
  return [...meaningsOf(b)].some((m) => ma.has(m)) || quizMeaning(a) === quizMeaning(b);
}

/** The answer plus three wrong options, from the same JLPT level first so they look alike. */
function pickChoices(entry: KanjiEntry, type: KanjiQuestionType): KanjiEntry[] {
  const pool = [
    ...shuffle(KANJI_LIST.filter((e) => e.level === entry.level)),
    ...shuffle(KANJI_LIST.filter((e) => e.level !== entry.level)),
  ];
  const choices = [entry];
  for (const candidate of pool) {
    if (choices.length >= CHOICE_COUNT) break;
    if (choices.every((c) => !overlaps(c, candidate, type))) choices.push(candidate);
  }
  return shuffle(choices);
}

/** A quiz over `entries` in random order; count 0 = all of them. */
export function buildKanjiQuiz(entries: KanjiEntry[], type: KanjiQuizType, count: number): KanjiQuestion[] {
  const picked = shuffle(entries).slice(0, count > 0 ? count : entries.length);
  return picked.map((entry) => {
    const questionType = type === 'mixed' ? QUESTION_TYPES[Math.floor(Math.random() * QUESTION_TYPES.length)] : type;
    return questionType === 'say'
      ? { entry, type: questionType }
      : { entry, type: questionType, choices: pickChoices(entry, questionType) };
  });
}

const isSingleKanji = (text: string) => /^\p{Script=Han}$/u.test(text);
const KANJI_BY_CHAR = new Map(KANJI_LIST.map((e) => [e.kanji, e]));

/**
 * A said or typed reading. Any on'yomi or kun'yomi counts, in hiragana or katakana,
 * kun'yomi with their okurigana (食: しょく, たべる, くう). The 「それは … です」 phrase
 * of the kanji test works too. Speech recognition often writes the reading as kanji:
 * the kanji itself, a word with it, or (spoken only) another kanji with the same
 * reading also count.
 */
export function isKanjiReadingCorrect(entry: KanjiEntry, answer: string, spoken = false): boolean {
  const readings = readingsOf(entry);
  return [stripKanjiTemplate(answer), normalizeReading(answer)].some((given) => {
    if (!given) return false;
    if (readings.has(given) || given.includes(entry.kanji)) return true;
    const other = isSingleKanji(given) ? KANJI_BY_CHAR.get(given) : undefined;
    return spoken && !!other && [...readingsOf(other)].some((r) => readings.has(r));
  });
}
