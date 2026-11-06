import type { GrammarPoint, GrammarSegment } from './grammar';
import { inLanguage } from './grammar';
import type { InstructionLanguage } from '../i18n';

// ─── Particle practice ──────────────────────────────────
// A sentence with one or more particles blanked out; the learner fills each blank from
// a particle keypad (or by typing its romaji). Sentences come from the AI (new ones
// each time, see generateParticleQuestions in ai.ts) or from the particle list's
// examples. Checked locally against the accepted particles of each blank.

/** The keypad, in the order of the particle list */
export const PARTICLE_KEYS = [
  'は', 'が', 'を', 'に', 'へ', 'で', 'と', 'や', 'の', 'も', 'から', 'まで', 'より',
  'か', 'ね', 'よ', 'よね', 'かな', 'しか', 'だけ', 'ぐらい', 'くらい', 'など', 'でも', 'ずつ',
] as const;

/** Typing a particle on a keyboard: its romaji as said (は = wa, を = o, へ = e) */
export const PARTICLE_ROMAJI: Record<string, string[]> = {
  は: ['wa', 'ha'], が: ['ga'], を: ['o', 'wo'], に: ['ni'], へ: ['e', 'he'], で: ['de'], と: ['to'],
  や: ['ya'], の: ['no'], も: ['mo'], から: ['kara'], まで: ['made'], より: ['yori'], か: ['ka'],
  ね: ['ne'], よ: ['yo'], よね: ['yone'], かな: ['kana'], しか: ['shika', 'sika'], だけ: ['dake'],
  ぐらい: ['gurai'], くらい: ['kurai'], など: ['nado'], でも: ['demo'], ずつ: ['zutsu', 'zutu'],
};

export interface ParticleQuestion {
  id: string;
  /** The sentence; marked segments are the blanks, with their accepted particles */
  segments: GrammarSegment[];
  /** The sentence as plain text (for listening) */
  text: string;
  /** In the UI language */
  translation: string;
  /** AI sentences: why each blank takes its particle (UI language) */
  explanations?: string[];
  /** List sentences: the particle use the sentence is an example of */
  point?: GrammarPoint;
}

export const blanksOf = (q: ParticleQuestion): GrammarSegment[] => q.segments.filter((s) => s.mark);

/** Is `answer` right for this blank? */
export function isParticleRight(blank: GrammarSegment, answer: string | undefined): boolean {
  return !!answer && (blank.accepted ?? [blank.text]).includes(answer);
}

/** A typed romaji buffer: the particle it names (exactly), and whether a longer one could still follow */
export function particleFromRomaji(buffer: string): { particle?: string; ambiguous: boolean } {
  const b = buffer.toLowerCase();
  let particle: string | undefined;
  let ambiguous = false;
  for (const [p, romaji] of Object.entries(PARTICLE_ROMAJI)) {
    for (const r of romaji) {
      if (r === b) particle ??= p;
      else if (r.startsWith(b)) ambiguous = true;
    }
  }
  return { particle, ambiguous };
}

/** Whether the start of a romaji word could still become a particle */
export function isParticlePrefix(buffer: string): boolean {
  const b = buffer.toLowerCase();
  return Object.values(PARTICLE_ROMAJI).some((rs) => rs.some((r) => r.startsWith(b)));
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Questions from the particle list's own examples (no AI): one random example per use,
 * in random order. `count` 0 = every use.
 */
export function buildParticleListQuiz(points: GrammarPoint[], count: number, lang: InstructionLanguage): ParticleQuestion[] {
  const picked = shuffle(points).slice(0, count > 0 ? count : points.length);
  return picked.map((point, i) => {
    const example = point.examples[Math.floor(Math.random() * point.examples.length)];
    return {
      id: `list-${i}-${point.id}`,
      segments: example.segments,
      text: example.text,
      translation: inLanguage(example.translation, lang),
      point,
    };
  });
}
