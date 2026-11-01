import details from '../data/kanji/details.json';
import type { JLPTLevel } from '../types';
import { JLPT_LEVELS } from '../types';
import { getCurriculum } from './kanjiCurriculum';
import { normalizeReading } from './ai';
import { kanaToRomaji, romajiMatches } from './romaji';
import type { VocabEntry } from './vocab';
import { VOCAB_ENTRIES } from './vocab';

// ─── Kanji list ─────────────────────────────────────────
// The Kanji page: every kanji of the curriculum (JLPT N5 → N1, in teaching order),
// with its meanings and readings from KANJIDIC and its parts from KRADFILE (src/data/kanji/details.json).

interface KanjiDetails {
  /** English meanings (KANJIDIC) */
  m: string[];
  /** On'yomi, in hiragana as KANJIDIC stores them */
  on: string[];
  /** Kun'yomi: okurigana after ".", "-" marks a prefix / suffix reading */
  kun: string[];
  /** Parts (KRADFILE elements), as ids of `parts` (one character each) */
  p: string;
  /** Larger parts (KanjiVG elements that aren't KRADFILE parts, e.g. 寺 in 待), ids of `components` */
  c?: string;
}

interface PartDetails {
  /** The part as shown, when the id is a stand-in kanji (化 → 亻, 汁 → 氵, 邦 / 阡 → 阝) */
  g?: string;
  /** English name */
  n: string;
  /** Stroke count, for grouping the picker */
  s: number;
  /** Search keys: KANJIDIC meanings and readings of the part as a kanji, Japanese part names */
  m?: string[];
  r?: string[];
  j?: string[];
}

interface ComponentDetails {
  m: string[];
  r: string[];
}

export interface KanjiEntry {
  kanji: string;
  level: JLPTLevel;
  /** Unit in the textbook, when the level's curriculum comes from one */
  unit?: string;
  /** Position within its level (teaching order), from 1 */
  number: number;
  meanings: string[];
  on: string[];
  kun: string[];
  /** Ids of the parts it is built from (see PARTS): 聞 → 耳, 門 */
  parts: string[];
  /** Larger parts it contains (see COMPONENTS): 待 → 寺 */
  components: string[];
}

export const KANJI_SOURCE = details.source;

const DETAILS = details.kanji as Record<string, KanjiDetails>;

/** Every kanji, level by level, in teaching order (the order the kanji section teaches them). */
export const KANJI_LIST: KanjiEntry[] = JLPT_LEVELS.flatMap((level) =>
  getCurriculum(level).kanji.map(({ kanji, unit }, i) => {
    const d = DETAILS[kanji];
    return {
      kanji,
      level,
      unit,
      number: i + 1,
      meanings: d?.m ?? [],
      on: d?.on ?? [],
      kun: d?.kun ?? [],
      parts: [...(d?.p ?? '')],
      components: [...(d?.c ?? '')],
    };
  })
);

export interface KanjiPart {
  /** Id in the data (KRADFILE's character for a part; the kanji itself for a larger part) */
  id: string;
  /** How it looks (亻 for the stand-in 化) */
  glyph: string;
  name: string;
  /** Stroke count (parts only; 0 for larger parts) */
  strokes: number;
  /** Kanji of the list that contain it */
  count: number;
  /** Search keys */
  meanings: string[];
  readings: string[];
  japaneseNames: string[];
}

/**
 * Whether a kanji contains a part: one of its KRADFILE parts, one of its larger parts
 * (KanjiVG), or the kanji itself. A kanji counts under every part: 聞 under 耳 and 門,
 * 待 under 彳, 寺, 土 and 寸.
 */
export const containsPart = (entry: KanjiEntry, id: string) =>
  entry.kanji === id || entry.parts.includes(id) || entry.components.includes(id);

const countOf = (id: string) => KANJI_LIST.filter((e) => containsPart(e, id)).length;

/**
 * Every part used by the list's kanji, in the usual parts-picker order (by stroke
 * count, as in KRADFILE's companion RADKFILE).
 */
export const PARTS: KanjiPart[] = Object.entries(details.parts as Record<string, PartDetails>)
  .map(([id, part]) => ({
    id,
    glyph: part.g ?? id,
    name: part.n,
    strokes: part.s,
    count: countOf(id),
    meanings: part.m ?? [],
    readings: part.r ?? [],
    japaneseNames: part.j ?? [],
  }))
  .filter((part) => part.count > 0);

/**
 * Larger parts that KRADFILE splits up (寺 = 土 + 寸, 各, 古, 令…), from KanjiVG; only
 * the ones in at least two kanji. Found by searching the picker, not shown in its grid.
 */
export const COMPONENTS: KanjiPart[] = Object.entries(details.components as Record<string, ComponentDetails>)
  .map(([id, c]) => ({
    id,
    glyph: id,
    name: c.m[0] ?? '',
    strokes: 0,
    count: countOf(id),
    meanings: c.m,
    readings: c.r,
    japaneseNames: [],
  }))
  .sort((a, b) => b.count - a.count);

const PART_BY_ID = new Map([...PARTS, ...COMPONENTS].map((p) => [p.id, p]));
export const findPart = (id: string) => PART_BY_ID.get(id);

const partRomajiCache = new Map<string, string[]>();
function partRomaji(part: KanjiPart): string[] {
  let romaji = partRomajiCache.get(part.id);
  if (!romaji) {
    romaji = [...part.readings, ...part.japaneseNames].map(kanaToRomaji);
    partRomajiCache.set(part.id, romaji);
  }
  return romaji;
}

/**
 * Picker search: the part itself, an English name or meaning (from the start of a word:
 * "temple" finds 寺), a reading or Japanese part name in kana (from the start: てら,
 * さんずい) or in romaji ("tera", "sanzui").
 */
export function matchesPartSearch(part: KanjiPart, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (q === part.glyph || q === part.id) return true;
  const wordStart = new RegExp(`(^|[^\\p{L}])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u');
  if ([part.name, ...part.meanings].some((m) => wordStart.test(m.toLowerCase()))) return true;
  const kana = normalizeReading(q);
  if (/^[ぁ-ゖー]+$/.test(kana) && [...part.readings, ...part.japaneseNames].some((r) => normalizeReading(r).startsWith(kana))) return true;
  return /^[a-zāīūēō'-]+$/.test(q) && partRomaji(part).some((r) => romajiMatches(r, q));
}


/** Hiragana → katakana (on'yomi are written in katakana, as in dictionaries). */
export const toKatakana = (text: string) =>
  text.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

/** A kun'yomi split into the kanji's part and the okurigana: "い.きる" → ["い", "きる"]. */
export function splitKun(reading: string): { stem: string; okurigana: string; prefix: boolean; suffix: boolean } {
  const suffix = reading.startsWith('-');
  const prefix = reading.endsWith('-');
  const [stem, okurigana = ''] = reading.replace(/-/g, '').split('.');
  return { stem, okurigana, prefix, suffix };
}

/** A reading as it is said: without the "." and "-" marks. */
export const plainReading = (reading: string) => reading.replace(/[.-]/g, '');

const readingsCache = new Map<string, { kana: string[]; romaji: string[] }>();
function readingsOf(entry: KanjiEntry) {
  let r = readingsCache.get(entry.kanji);
  if (!r) {
    const kana = [...new Set([...entry.on, ...entry.kun].map(plainReading))];
    r = { kana, romaji: kana.map(kanaToRomaji) };
    readingsCache.set(entry.kanji, r);
  }
  return r;
}

const hasKanji = (text: string) => /\p{Script=Han}/u.test(text);

/**
 * Search: kanji in the query ("日本語" finds 日, 本, 語), a reading in kana (from the
 * start, katakana works too), a reading in romaji, or an English meaning (from the
 * start of a word, so "eat" finds "Eat" but not "Great").
 */
export function matchesKanjiSearch(entry: KanjiEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (hasKanji(q)) return q.includes(entry.kanji);
  const { kana, romaji } = readingsOf(entry);
  const qKana = normalizeReading(q);
  if (qKana && kana.some((r) => r.startsWith(qKana))) return true;
  if (/^[a-zāīūēō'-]+$/.test(q) && romaji.some((r) => romajiMatches(r, q))) return true;
  const wordStart = new RegExp(`(^|[^\\p{L}])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u');
  return entry.meanings.some((m) => wordStart.test(m.toLowerCase()));
}

export interface KanjiExample {
  word: VocabEntry;
  /** The spelling that has the kanji */
  written: string;
  /** How the word is said (hiragana) */
  said: string;
  /** The kanji's reading this word shows (raw, as in `on` / `kun`), and where it sits in `said` */
  reading?: string;
  start?: number;
  end?: number;
}

// Sound changes a reading can take inside a word: 学 がく → がっ(こう), 国 こく → (外)ごく
const VOICED: Record<string, string> = {
  か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ',
  た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ',
};
const SEMI_VOICED: Record<string, string> = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };

function soundVariants(reading: string): string[] {
  const variants = [reading];
  if (reading.length > 1 && /[くきつち]$/.test(reading)) variants.push(reading.slice(0, -1) + 'っ');
  for (const v of [...variants]) {
    for (const table of [VOICED, SEMI_VOICED]) {
      const first = table[v[0]];
      if (first) variants.push(first + v.slice(1));
    }
  }
  return variants;
}

/** Which of the kanji's readings a word uses, and where it is in the word's kana. */
export function readingInWord(entry: KanjiEntry, written: string, said: string): Pick<KanjiExample, 'reading' | 'start' | 'end'> {
  const pos = written.indexOf(entry.kanji);
  const atStart = pos === 0;
  const atEnd = pos === written.length - 1;
  // Kun'yomi with okurigana first (they are the most specific: 生きる vs 生まれる), then the longest readings
  const readings = [...entry.kun, ...entry.on].sort((a, b) =>
    Number(b.includes('.')) - Number(a.includes('.')) || plainReading(b).length - plainReading(a).length);
  for (const reading of readings) {
    const { stem, okurigana } = splitKun(reading);
    if (okurigana) {
      const kana = stem + okurigana;
      const start = said.indexOf(kana);
      if (written.includes(entry.kanji + okurigana) && start >= 0 && (!atStart || start === 0)) {
        return { reading, start, end: start + kana.length };
      }
      continue;
    }
    for (const v of soundVariants(stem)) {
      const start = atStart ? (said.startsWith(v) ? 0 : -1)
        : atEnd && written.length > 1 ? (said.endsWith(v) ? said.length - v.length : -1)
        : said.indexOf(v);
      if (start >= 0) return { reading, start, end: start + v.length };
    }
  }
  // A form the readings don't list (見つける: み.る, み.える…): highlight the stem only, without counting it for a reading
  for (const reading of readings) {
    const { stem, okurigana } = splitKun(reading);
    if (okurigana && atStart && said.startsWith(stem)) return { start: 0, end: stem.length };
  }
  return {};
}

/**
 * Example words for a kanji from the Words page lists (also through another spelling).
 * One word for each of its readings comes first, in the order the readings are shown
 * (on'yomi, then the first `maxKun` kun'yomi, as many as the card shows), then other words; easiest JLPT level first within that.
 */
export function examplesFor(entry: KanjiEntry, limit = 4, maxKun = 6): KanjiExample[] {
  const rank = (e: VocabEntry) => (e.jlpt ? JLPT_LEVELS.indexOf(e.jlpt) : JLPT_LEVELS.length);
  const candidates: KanjiExample[] = VOCAB_ENTRIES
    .filter((e) => [e.word, ...(e.spellings ?? [])].some((w) => w.includes(entry.kanji)))
    .sort((a, b) => rank(a) - rank(b))
    .map((word) => {
      const written = [word.word, ...(word.spellings ?? [])].find((w) => w.includes(entry.kanji)) ?? word.word;
      const said = normalizeReading(word.reading ?? word.word);
      return { word, written, said, ...readingInWord(entry, written, said) };
    });
  const picked: KanjiExample[] = [];
  for (const reading of [...entry.on, ...entry.kun.slice(0, maxKun)]) {
    const example = candidates.find((c) => c.reading === reading && !picked.includes(c));
    if (example) picked.push(example);
  }
  for (const c of candidates) if (!picked.includes(c)) picked.push(c);
  return picked.slice(0, limit);
}
