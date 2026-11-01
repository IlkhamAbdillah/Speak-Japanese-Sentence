import data from '../data/kanji/words.json';
import type { JLPTLevel } from '../types';
import type { KanjiEntry } from './kanjiList';
import { KANJI_LIST, plainReading, readingInWord, splitKun } from './kanjiList';
import { normalizeReading, stripKanjiTemplate } from './ai';

// ─── Kanji reading practice ─────────────────────────────
// One kanji's practice (the "Practice readings" button of its card): JLPT words with
// the kanji, and the learner says or types how the kanji is read in that word (only
// the kanji's part: 食事 → しょく). Common words come first, picked at random each time.
// Checked locally, no AI. A finished practice is what moves the kanji's progress.

export const KANJI_WORDS_SOURCE = data.source;

/** Questions in one practice (fewer when the kanji has fewer words) */
export const PRACTICE_QUESTION_COUNT = 5;

/** Right on the first try this share of a practice = a good practice (streak + 1) */
export const PRACTICE_PASS_RATE = 0.8;

export interface PracticeWord {
  written: string;
  /** Readings, most common first (今日: きょう, こんにち) */
  readings: string[];
  /** English meaning */
  meaning: string;
  level: JLPTLevel;
  /** wordfreq Zipf frequency (0 = unknown) */
  zipf: number;
}

export interface KanjiPracticeQuestion {
  entry: KanjiEntry;
  word: PracticeWord;
  /** The word's reading the question shows on reveal */
  said: string;
  /** Where the kanji's part sits in `said` */
  start: number;
  end: number;
  /** The kanji's reading it uses, as in `on` / `kun` */
  reading: string;
  onyomi: boolean;
  /** Answers that count (normalised hiragana) */
  answers: string[];
}

type RawWord = [string, string, string, JLPTLevel, number];

const WORDS: PracticeWord[] = (data.words as RawWord[]).map(([written, readings, meaning, level, zipf]) => ({
  written, readings: readings.split('|'), meaning, level, zipf: zipf / 10,
}));

const KANJI_BY_CHAR = new Map(KANJI_LIST.map((e) => [e.kanji, e]));
const readingsOf = (e: KanjiEntry) => new Set([...e.on, ...e.kun].map((r) => normalizeReading(plainReading(r))));

/** A word as a question about one kanji, or null when the kanji's part of the reading can't be found (今日 きょう). */
function questionFor(entry: KanjiEntry, word: PracticeWord): KanjiPracticeQuestion | null {
  const { written } = word;
  // The kanji twice (人人) would make "its part" ambiguous
  if (written.indexOf(entry.kanji) !== written.lastIndexOf(entry.kanji)) return null;
  let question: KanjiPracticeQuestion | null = null;
  const answers = new Set<string>();
  for (const raw of word.readings) {
    const said = normalizeReading(raw);
    const { reading, start, end } = readingInWord(entry, written, said);
    if (!reading || start === undefined || end === undefined) continue;
    const { stem, okurigana } = splitKun(reading);
    // The kanji's part ends before the okurigana: 食べる → た
    const kanjiEnd = okurigana ? start + stem.length : end;
    // The sound in the word (がっ in 学校), the reading as listed (がく), with okurigana (たべる), the whole word
    for (const a of [said.slice(start, kanjiEnd), stem, stem + okurigana, said]) answers.add(normalizeReading(a));
    question ??= { entry, word, said, start, end: kanjiEnd, reading, onyomi: entry.on.includes(reading), answers: [] };
  }
  return question && { ...question, answers: [...answers] };
}

const wordsCache = new Map<string, KanjiPracticeQuestion[]>();

/** Every word the practice can ask for a kanji, most common first. */
export function practiceWordsFor(entry: KanjiEntry): KanjiPracticeQuestion[] {
  let questions = wordsCache.get(entry.kanji);
  if (!questions) {
    questions = WORDS
      .filter((w) => w.written.includes(entry.kanji))
      .map((w) => questionFor(entry, w))
      .filter((q): q is KanjiPracticeQuestion => !!q)
      .sort((a, b) => b.word.zipf - a.word.zipf);
    wordsCache.set(entry.kanji, questions);
  }
  return questions;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Each step down in Zipf frequency (10× rarer) makes a word this many times less likely */
const RARER_WEIGHT = 3;
/** A reading already asked makes its other words this many times less likely, so on and kun both come up */
const SAME_READING_WEIGHT = 4;

/**
 * A practice for one kanji, different each time: words drawn at random, common words
 * far more likely than rare ones, and spread over its readings. Asked in random order.
 */
export function buildKanjiPractice(entry: KanjiEntry, count = PRACTICE_QUESTION_COUNT): KanjiPracticeQuestion[] {
  const pool = [...practiceWordsFor(entry)];
  if (pool.length === 0) return [];
  const top = pool[0].word.zipf;
  const picked: KanjiPracticeQuestion[] = [];
  while (picked.length < count && pool.length > 0) {
    const weights = pool.map((q) =>
      RARER_WEIGHT ** (q.word.zipf - top) / SAME_READING_WEIGHT ** picked.filter((p) => p.reading === q.reading).length);
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < pool.length - 1 && (r -= weights[i]) > 0) i++;
    picked.push(pool.splice(i, 1)[0]);
  }
  return shuffle(picked);
}

const isSingleKanji = (text: string) => /^\p{Script=Han}$/u.test(text);

/**
 * A said or typed reading of the kanji's part (食事 → しょく; がく for 学校's がっ and
 * the whole word also count), hiragana or katakana, also in the 「それは … です」 phrase.
 * Speech recognition often writes it as kanji: the word, the kanji itself, or another
 * kanji with that reading count when spoken.
 */
export function isPracticeAnswerCorrect(question: KanjiPracticeQuestion, answer: string, spoken = false): boolean {
  return [stripKanjiTemplate(answer), normalizeReading(answer)].some((given) => {
    if (!given) return false;
    if (question.answers.includes(given) || given === question.word.written) return true;
    if (!spoken || !isSingleKanji(given)) return false;
    if (given === question.entry.kanji) return true;
    const other = KANJI_BY_CHAR.get(given);
    return !!other && [...readingsOf(other)].some((r) => question.answers.includes(r));
  });
}
