import n5 from '../data/grammar/n5.txt?raw';
import n4 from '../data/grammar/n4.txt?raw';
import n3 from '../data/grammar/n3.txt?raw';
import n2 from '../data/grammar/n2.txt?raw';
import n1 from '../data/grammar/n1.txt?raw';
import particles from '../data/grammar/particles.txt?raw';
import type { GrammarQuizType, JLPTLevel } from '../types';
import type { InstructionLanguage } from '../i18n';
import { normalizeReading } from './ai';
import { kanaToRomaji, romajiMatches } from './romaji';

// ─── Grammar list (文法) ────────────────────────────────
// JLPT grammar points N5 → N1, written for the app in src/data/grammar/<level>.txt
// (format in that folder's README). The files are parsed here once; the quiz is
// built and checked locally, without any AI call.

type Translated = Partial<Record<InstructionLanguage, string>> & { en: string };

/** A piece of an example sentence; `mark` = the part that is the grammar point */
export interface GrammarSegment {
  text: string;
  mark?: boolean;
  /** Marked parts: every answer that is right there ([へ|に] → へ, に); `text` is the first */
  accepted?: string[];
}

export interface GrammarExample {
  segments: GrammarSegment[];
  /** The sentence as plain text (for listening) */
  text: string;
  translation: Translated;
}

export interface GrammarPoint {
  /** Stable while the files keep their order: level + position, e.g. "N4-12" */
  id: string;
  level: JLPTLevel;
  /** Position in its level (1-based), shown in the list */
  number: number;
  /** As listed, e.g. 〜てもいい, 〜ために (reason) */
  pattern: string;
  /** Kana reading of a pattern written with kanji, for searching */
  reading?: string;
  meaning: Translated;
  /** How it attaches: V-dict + ことができる (abbreviations in the ⓘ dialog) */
  formation: string;
  /** Groups of points that are easy to confuse (the `s` line); never offered as each other's wrong options */
  groups: string[];
  examples: GrammarExample[];
  /** Particle list only: the particle this use belongs to (に for "に (time)") */
  particle?: string;
}

const LEVEL_FILES: [JLPTLevel, string][] = [['N5', n5], ['N4', n4], ['N3', n3], ['N2', n2], ['N1', n1]];

/** "en | id" → { en, id } */
function translated(text: string, ...langs: InstructionLanguage[]): Translated {
  const parts = text.split(' | ').map((p) => p.trim());
  const result: Translated = { en: parts[0] ?? '' };
  langs.forEach((lang, i) => {
    if (parts[i]) result[lang] = parts[i];
  });
  return result;
}

/** 私[は]学生[です]。 → segments with the bracketed parts marked; [へ|に] = both are right */
export function parseSentence(text: string): GrammarSegment[] {
  const segments: GrammarSegment[] = [];
  for (const [i, piece] of text.split(/[[\]]/).entries()) {
    if (!piece) continue;
    if (i % 2 === 0) segments.push({ text: piece });
    else {
      const accepted = piece.split('|').map((a) => a.trim()).filter(Boolean);
      segments.push({ text: accepted[0], mark: true, accepted });
    }
  }
  return segments;
}

/**
 * One file of points. `level` is the file's level; a point's `l` line overrides it
 * (the particle file mixes levels). `idPrefix` names the list in the ids (N4-12, P-3).
 */
function parseLevel(level: JLPTLevel, source: string, idPrefix: string = level): GrammarPoint[] {
  const points: GrammarPoint[] = [];
  for (const block of source.split(/\n(?=@ )/)) {
    if (!block.startsWith('@ ')) continue;
    const lines = block.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    const [pattern, reading] = lines[0].slice(2).split(' | ').map((p) => p.trim());
    let meaning: Translated = { en: '' };
    let formation = '';
    let groups: string[] = [];
    let pointLevel = level;
    const examples: GrammarExample[] = [];
    for (const line of lines.slice(1)) {
      const body = line.slice(2);
      if (line.startsWith('= ')) meaning = translated(body, 'en', 'id');
      else if (line.startsWith('f ')) formation = body;
      else if (line.startsWith('s ')) groups = body.split(',').map((g) => g.trim()).filter(Boolean);
      else if (line.startsWith('l ')) pointLevel = body.trim() as JLPTLevel;
      else if (line.startsWith('e ')) {
        const [sentence, ...rest] = body.split(' | ');
        const segments = parseSentence(sentence.trim());
        examples.push({
          segments,
          text: segments.map((s) => s.text).join(''),
          translation: translated(rest.join(' | '), 'en', 'id'),
        });
      }
    }
    points.push({
      id: `${idPrefix}-${points.length + 1}`, level: pointLevel, number: points.length + 1,
      pattern, reading, meaning, formation, groups, examples,
    });
  }
  return points;
}

export const GRAMMAR_POINTS: GrammarPoint[] = LEVEL_FILES.flatMap(([level, source]) => parseLevel(level, source));

// ─── Particle list (助詞) ───────────────────────────────
// src/data/grammar/particles.txt: every use of the common particles, grouped by particle
// ("に (time)", "に (destination)"…), kept apart from the grammar list (user-requested).

export const PARTICLE_POINTS: GrammarPoint[] = parseLevel('N5', particles, 'P')
  .map((p) => ({ ...p, particle: p.pattern.split(/[\s〜]/)[0] }));

const PARTICLE_SOUND: Record<string, string> = { は: 'wa', へ: 'e', を: 'o' };

/** The particles of the list, in list order (は, が, を, に…) */
export const PARTICLES: string[] = [...new Set(PARTICLE_POINTS.map((p) => p.particle!))];

/** The text in the UI language, falling back to English. */
export function inLanguage(text: Translated, lang: InstructionLanguage): string {
  return text[lang] ?? text.en;
}

/** The pattern without its note: 〜ために (reason) → 〜ために */
export function patternLabel(point: GrammarPoint): string {
  return point.pattern.replace(/\s*\([^)]*[a-z][^)]*\)/gi, '').trim();
}

// ─── Search ─────────────────────────────────────────────

// The kana spellings of a pattern ("〜が好き / 〜が嫌い" + "がすき / がきらい"), worked out once
const kanaCache = new Map<string, string[]>();
function kanaOf(point: GrammarPoint): string[] {
  let kana = kanaCache.get(point.id);
  if (!kana) {
    kana = [patternLabel(point), point.reading ?? '']
      .flatMap((text) => text.split(/[/／・]/))
      .map((text) => normalizeReading(text.replace(/[〜~()（）+＋]/g, '')))
      .filter(Boolean);
    kanaCache.set(point.id, kana);
  }
  return kana;
}

/**
 * Search by pattern (kana or kanji; 〜 can be left out), romaji ("temo", "tame ni")
 * or meaning (from a word start, in any language).
 */
export function matchesGrammarSearch(point: GrammarPoint, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const kana = normalizeReading(q.replace(/[〜~]/g, ''));
  if (kana && kanaOf(point).some((k) => k.includes(kana))) return true;
  if (/^[a-z\s'-]+$/.test(q)) {
    const compact = q.replace(/[\s'-]/g, '');
    const romaji = kanaOf(point).map(kanaToRomaji).filter((r) => /^[a-z]+$/.test(r));
    // は, へ and を as particles are said wa, e, o
    const said = point.particle ? PARTICLE_SOUND[point.particle] : undefined;
    if (said && said.startsWith(compact)) return true;
    if (romaji.some((r) => r.includes(compact) || romajiMatches(r, compact))) return true;
  }
  const wordStart = new RegExp(`(^|[^\\p{L}])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u');
  return Object.values(point.meaning).some((m) => m && wordStart.test(m.toLowerCase()));
}

// ─── Quiz ───────────────────────────────────────────────

export type GrammarQuestionType = Exclude<GrammarQuizType, 'mixed'>;

export interface GrammarQuestion {
  point: GrammarPoint;
  type: GrammarQuestionType;
  /** Fill in the blank: the example sentence asked */
  example?: GrammarExample;
  /** The options (the answer among them) and their labels */
  choices: { point: GrammarPoint; label: string }[];
}

const CHOICE_COUNT = 4;
const QUESTION_TYPES: GrammarQuestionType[] = ['blank', 'meaning'];

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const pickOne = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

/** The senses of an English meaning: "may, it's OK to" → ["may", "it's ok to"] */
function senses(meaning: string): string[] {
  return meaning
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .split(/[,;/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Two points that could both answer the same question: the same group (ましょう /
 * ませんか, について / に関して) or a shared sense (から / ので: both "because").
 */
function overlaps(a: GrammarPoint, b: GrammarPoint): boolean {
  if (a.id === b.id || patternLabel(a) === patternLabel(b)) return true;
  if (a.groups.some((g) => b.groups.includes(g))) return true;
  const sb = new Set(senses(b.meaning.en));
  return senses(a.meaning.en).some((s) => sb.has(s));
}

/** The marked parts of an example, as one choice: は…です */
function blankLabel(example: GrammarExample): string {
  return example.segments.filter((s) => s.mark).map((s) => s.text).join('…');
}

const markCount = (example: GrammarExample) => example.segments.filter((s) => s.mark).length;

/**
 * Two-part blanks that share their first or last part often both fit (母[は]台所[にいます]
 * vs は…です), so such a pair is never offered together.
 */
function sharesPart(a: string, b: string): boolean {
  const pa = a.split('…');
  const pb = b.split('…');
  if (pa.length === 1 && pb.length === 1) return false;
  return pa[0] === pb[0] || pa.at(-1) === pb.at(-1);
}

function blankQuestion(point: GrammarPoint, pool: GrammarPoint[]): GrammarQuestion {
  const example = pickOne(point.examples);
  const answer = blankLabel(example);
  const choices = [{ point, label: answer }];
  // Wrong options: other points' marked parts, preferring ones with as many blanks
  const candidates = shuffle(pool)
    .filter((p) => !overlaps(point, p))
    .map((p) => ({ point: p, example: pickOne(p.examples) }))
    .sort((a, b) => Number(markCount(a.example) !== markCount(example)) - Number(markCount(b.example) !== markCount(example)));
  for (const c of candidates) {
    if (choices.length >= CHOICE_COUNT) break;
    const label = blankLabel(c.example);
    if (choices.every((o) => o.label !== label && !sharesPart(o.label, label) && !overlaps(o.point, c.point))) {
      choices.push({ point: c.point, label });
    }
  }
  return { point, type: 'blank', example, choices: shuffle(choices) };
}

function meaningQuestion(point: GrammarPoint, pool: GrammarPoint[]): GrammarQuestion {
  const choices = [{ point, label: patternLabel(point) }];
  for (const p of shuffle(pool)) {
    if (choices.length >= CHOICE_COUNT) break;
    const label = patternLabel(p);
    if (choices.every((o) => o.label !== label && !overlaps(o.point, p))) choices.push({ point: p, label });
  }
  return { point, type: 'meaning', choices: shuffle(choices) };
}

/**
 * A quiz over `points` in random order. Wrong options come from the same JLPT level
 * (the whole level, so a retry of a few points still has enough of them).
 */
export function buildGrammarQuiz(points: GrammarPoint[], type: GrammarQuizType, count: number): GrammarQuestion[] {
  const picked = shuffle(points).slice(0, count > 0 ? count : points.length);
  return picked.map((point) => {
    const pool = GRAMMAR_POINTS.filter((p) => p.level === point.level);
    const questionType = type === 'mixed' ? pickOne(QUESTION_TYPES) : type;
    return questionType === 'blank' ? blankQuestion(point, pool) : meaningQuestion(point, pool);
  });
}
