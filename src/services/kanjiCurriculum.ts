import jlptLists from '../data/kanji/jlpt.json';
import souMatomeN4 from '../data/kanji/sou-matome-n4.json';
import type { JLPTLevel } from '../types';
import { JLPT_LEVELS } from '../types';

// ─── Kanji curriculum ───────────────────────────────────
// Which kanji each JLPT level teaches, in teaching order. The kanji section picks
// its targets from here instead of letting the AI choose. See src/data/kanji/README.md.

export interface CurriculumKanji {
  kanji: string;
  /** Unit in the textbook, when the curriculum comes from one */
  unit?: string;
}

export interface Curriculum {
  level: JLPTLevel;
  source: string;
  kanji: CurriculumKanji[];
}

interface TextbookCurriculum {
  level: JLPTLevel;
  source: string;
  units: { unit: string; kanji: string }[];
}

const isKanji = (ch: string) => /\p{Script=Han}/u.test(ch);

/** The distinct kanji in a text, in order (spaces, commas and kana are ignored). */
export const kanjiIn = (text: string): string[] => [...new Set([...text].filter(isKanji))];

/** Textbook lists replace the JLPT list of their level once they have kanji. */
const TEXTBOOKS = [souMatomeN4 as TextbookCurriculum];

function buildCurricula(): Record<JLPTLevel, Curriculum> {
  const curricula = {} as Record<JLPTLevel, Curriculum>;
  for (const level of JLPT_LEVELS) {
    curricula[level] = {
      level,
      source: jlptLists.source,
      kanji: kanjiIn(jlptLists.levels[level]).map((kanji) => ({ kanji })),
    };
  }
  for (const book of TEXTBOOKS) {
    const seen = new Set<string>();
    const kanji = book.units.flatMap(({ unit, kanji: text }) =>
      kanjiIn(text).filter((k) => !seen.has(k) && seen.add(k)).map((k) => ({ kanji: k, unit }))
    );
    if (kanji.length > 0) curricula[book.level] = { level: book.level, source: book.source, kanji };
  }
  return curricula;
}

const CURRICULA = buildCurricula();

// The level each kanji is taught at; a textbook list wins over the JLPT list
const LEVEL_OF = new Map<string, JLPTLevel>();
for (const level of JLPT_LEVELS) {
  for (const k of kanjiIn(jlptLists.levels[level])) LEVEL_OF.set(k, level);
}
for (const level of JLPT_LEVELS) {
  if (CURRICULA[level].source !== jlptLists.source) {
    for (const { kanji } of CURRICULA[level].kanji) LEVEL_OF.set(kanji, level);
  }
}

export function getCurriculum(level: JLPTLevel): Curriculum {
  return CURRICULA[level];
}

/**
 * Whether a kanji may appear in a word for a learner at `level`: kanji from this
 * level and the easier ones. At N1 anything goes.
 */
export function isKanjiAllowedAt(kanji: string, level: JLPTLevel): boolean {
  if (level === 'N1') return true;
  const kanjiLevel = LEVEL_OF.get(kanji);
  return !!kanjiLevel && JLPT_LEVELS.indexOf(kanjiLevel) <= JLPT_LEVELS.indexOf(level);
}

/** A mock test's kanji: `count` different kanji of the level's list, at random. */
export function pickTestKanji(curriculum: Curriculum, count: number): string[] {
  const kanji = curriculum.kanji.map((k) => k.kanji);
  for (let i = kanji.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kanji[i], kanji[j]] = [kanji[j], kanji[i]];
  }
  return kanji.slice(0, count);
}
