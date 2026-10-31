import words from '../data/vocab/words.json';
import verbs from '../data/vocab/verbs.json';
import type { JLPTLevel, UserSettings, VocabCategory, VocabFrequency, VocabQuizType } from '../types';
import type { InstructionLanguage } from '../i18n';
import { normalizeReading } from './ai';

// ─── Word list ──────────────────────────────────────────
// Onomatopoeia, adverbs, conjunctions, verbs and adjectives with their meanings
// (src/data/vocab/words.json; verbs from the Japanese Verb Conjugator list in verbs.json).
// The quiz is built and checked here, without any AI call.

export type VocabEntryCategory = VocabCategory;

export interface VocabEntry {
  /** Stable id: category + position in the list */
  id: string;
  category: VocabEntryCategory;
  /** As written in the list (kana, or kanji for a few adverbs) */
  word: string;
  /** Hiragana reading, for words written with kanji */
  reading?: string;
  /** Verbs: romaji as given by the source list, for searching */
  romaji?: string;
  /** Other spellings that count as correct (speech recognition often writes kanji) */
  spellings?: string[];
  /** Related words noted in the list (↔ / →) */
  see?: string[];
  /** Verbs: 1 = godan (u-verb), 2 = ichidan (ru-verb), 3 = irregular */
  verbGroup?: 1 | 2 | 3;
  /** Adjectives: い or な */
  adjType?: 'i' | 'na';
  /** The easiest JLPT level whose vocabulary list has the word; missing = on no list */
  jlpt?: JLPTLevel;
  /** How common the word is in everyday Japanese */
  frequency: VocabFrequency;
  /** Meaning group (movement, food, talk…); the data files list related words next to each other */
  topic: string;
  meaning: Partial<Record<InstructionLanguage, string>> & { en: string };
}

type RawEntry = Omit<VocabEntry, 'id' | 'category'>;

function withIds(category: VocabEntryCategory, list: RawEntry[]): VocabEntry[] {
  return list.map((entry, i) => ({ ...entry, id: `${category}-${i + 1}`, category }));
}

export const VOCAB_ENTRIES: VocabEntry[] = [
  ...withIds('onomatopoeia', words.onomatopoeia as RawEntry[]),
  ...withIds('adverb', words.adverb as RawEntry[]),
  ...withIds('conjunction', words.conjunction as RawEntry[]),
  ...withIds('verb', verbs.verbs as RawEntry[]),
  ...withIds('adjective', words.adjective as RawEntry[]),
];

/** Where the verb list comes from, credited on the Words page */
export const VERB_SOURCE = { name: 'Japanese Verb Conjugator', url: verbs.url };

type VocabFilters = Pick<UserSettings, 'vocabCategory' | 'vocabVerbGroup' | 'vocabAdjType' | 'vocabFrequency'>;

/** How common applies to every list (JLPT levels are the list's sections); the group to verbs, い/な to adjectives. */
export function applyVocabFilters(entries: VocabEntry[], f: VocabFilters): VocabEntry[] {
  return entries.filter((e) =>
    (f.vocabFrequency === 'all' || e.frequency === f.vocabFrequency) &&
    (f.vocabCategory !== 'verb' || f.vocabVerbGroup === 'all' || String(e.verbGroup) === f.vocabVerbGroup) &&
    (f.vocabCategory !== 'adjective' || f.vocabAdjType === 'all' || e.adjType === f.vocabAdjType));
}

type QuizFilters = Pick<UserSettings, 'vocabQuizJlpt' | 'vocabQuizFrequency' | 'vocabQuizVerbGroups' | 'vocabQuizAdjTypes'>;

/** Quiz filters: a word matches when it has any picked value of each filter (none picked = any). */
export function applyQuizFilters(entries: VocabEntry[], f: QuizFilters): VocabEntry[] {
  const picked = <T,>(values: readonly T[], value: T) => values.length === 0 || values.includes(value);
  return entries.filter((e) =>
    picked(f.vocabQuizJlpt, e.jlpt ?? 'none') &&
    picked(f.vocabQuizFrequency, e.frequency) &&
    (!e.verbGroup || picked(f.vocabQuizVerbGroups, String(e.verbGroup) as '1' | '2' | '3')) &&
    (!e.adjType || picked(f.vocabQuizAdjTypes, e.adjType)));
}

// Every list is shown easiest first, JLPT N5 → N1 → none, and within a level related words
// sit together (歩く/走る, 買う/売る, 暑い/寒い), in the order of the data files, which are
// grouped by `topic` (user-requested; how common and the group are shown and filtered,
// not sort keys).
const JLPT_ORDER: (JLPTLevel | undefined)[] = ['N5', 'N4', 'N3', 'N2', 'N1', undefined];

function compareWords(a: VocabEntry, b: VocabEntry): number {
  return JLPT_ORDER.indexOf(a.jlpt) - JLPT_ORDER.indexOf(b.jlpt) ||
    VOCAB_ENTRIES.indexOf(a) - VOCAB_ENTRIES.indexOf(b);
}

const SORTED_ENTRIES: VocabEntry[] = [...VOCAB_ENTRIES].sort(compareWords);

/** A category's words in list order (see compareWords). */
export function entriesOf(category: VocabCategory): VocabEntry[] {
  return SORTED_ENTRIES.filter((e) => e.category === category);
}

/** The meaning in the UI language, falling back to English. */
export function meaningOf(entry: VocabEntry, lang: InstructionLanguage): string {
  return entry.meaning[lang] ?? entry.meaning.en;
}

/** Search the list by word, reading, spelling or meaning (in any language). */
export function matchesSearch(entry: VocabEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const kana = normalizeReading(q);
  const texts = [entry.word, entry.reading ?? '', ...(entry.spellings ?? [])];
  // Meanings match from the start of a word, so "eat" finds "Eat" but not "Repeat"
  const wordStart = new RegExp(`(^|[^\\p{L}])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u');
  return texts.some((text) => text && normalizeReading(text).includes(kana)) ||
    !!entry.romaji?.startsWith(q) ||
    Object.values(entry.meaning).some((m) => m && wordStart.test(m.toLowerCase()));
}

// ─── Quiz ───────────────────────────────────────────────

export type VocabQuestionType = Exclude<VocabQuizType, 'mixed'>;

export interface VocabQuestion {
  entry: VocabEntry;
  type: VocabQuestionType;
  /** Multiple choice (meaning / word): the options, the answer among them */
  choices?: VocabEntry[];
}

const CHOICE_COUNT = 4;
const QUESTION_TYPES: VocabQuestionType[] = ['meaning', 'word', 'say'];

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * The separate senses of a meaning: "① Lumayan, biasa-biasa saja ② Ayolah!" →
 * ["lumayan", "biasa-biasa saja", "ayolah!"]. Notes in parentheses are ignored.
 */
function senses(meaning: string): string[] {
  return meaning
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .split(/[,;①②、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Two words that could both answer the same question (same sense, or same kana). */
function overlaps(a: VocabEntry, b: VocabEntry): boolean {
  if (a.id === b.id) return true;
  if (normalizeReading(a.reading ?? a.word) === normalizeReading(b.reading ?? b.word)) return true;
  return Object.keys(a.meaning).some((lang) => {
    const ma = a.meaning[lang as InstructionLanguage];
    const mb = b.meaning[lang as InstructionLanguage];
    if (!ma || !mb) return false;
    const sb = new Set(senses(mb));
    return senses(ma).some((s) => sb.has(s));
  });
}

/** The answer plus three wrong options that don't share a sense with it or each other. */
function pickChoices(entry: VocabEntry, pool: VocabEntry[]): VocabEntry[] {
  const choices = [entry];
  for (const candidate of shuffle(pool)) {
    if (choices.length >= CHOICE_COUNT) break;
    if (choices.every((c) => !overlaps(c, candidate))) choices.push(candidate);
  }
  return shuffle(choices);
}

/**
 * A quiz over `entries` in random order. Wrong options come from `pool` (the whole
 * category), so a retry of a few words still has enough of them.
 */
export function buildVocabQuiz(
  entries: VocabEntry[],
  type: VocabQuizType,
  count: number,
  pool: VocabEntry[] = entries
): VocabQuestion[] {
  const picked = shuffle(entries).slice(0, count > 0 ? count : entries.length);
  return picked.map((entry) => {
    const questionType = type === 'mixed' ? QUESTION_TYPES[Math.floor(Math.random() * QUESTION_TYPES.length)] : type;
    return questionType === 'say'
      ? { entry, type: questionType }
      : { entry, type: questionType, choices: pickChoices(entry, pool) };
  });
}

/**
 * A said or typed answer. Kana and katakana count the same; kanji spellings from
 * speech recognition are accepted, and so is another listed word with exactly
 * the same meaning (ちっとも / 全然). A spoken answer may also come back as a
 * word with the same sound (暑い said, 熱い written): the learner can't choose
 * which kanji speech recognition writes.
 */
export function isVocabAnswerCorrect(entry: VocabEntry, answer: string, lang: InstructionLanguage, spoken = false): boolean {
  const given = normalizeReading(answer);
  if (!given) return false;
  const meaning = meaningOf(entry, lang);
  const sound = normalizeReading(entry.reading ?? entry.word);
  const accepted = VOCAB_ENTRIES
    .filter((e) => e.id === entry.id || meaningOf(e, lang) === meaning ||
      (spoken && normalizeReading(e.reading ?? e.word) === sound))
    .flatMap((e) => [e.word, e.reading ?? '', ...(e.spellings ?? [])])
    .filter(Boolean)
    .map(normalizeReading);
  return accepted.includes(given);
}
