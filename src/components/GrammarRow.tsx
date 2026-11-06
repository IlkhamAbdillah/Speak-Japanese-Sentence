import { ChevronRight } from 'lucide-react';
import type { GrammarExample, GrammarPoint } from '../services/grammar';
import { inLanguage } from '../services/grammar';
import { useI18n } from '../i18n';

/**
 * An example sentence with its grammar part highlighted, or (`blank`) replaced by a
 * blank for the quiz; a part split in two (は…です) gets two blanks.
 */
export function GrammarSentence({ example, blank = false }: { example: GrammarExample; blank?: boolean }) {
  return (
    <>
      {example.segments.map((s, i) =>
        !s.mark ? <span key={i}>{s.text}</span>
          : blank ? <span key={i} className="grammar-blank" aria-label="___">{'　'.repeat(Math.max(2, Math.min(4, s.text.length)))}</span>
            : <mark key={i} className="grammar-mark">{s.text}</mark>)}
    </>
  );
}

interface GrammarRowProps {
  point: GrammarPoint;
  /** Position in its level, shown before the pattern (the list) */
  number?: number;
  onOpen: () => void;
  /** Practice progress (grammar list): learning / mastered get a coloured edge */
  status?: 'new' | 'learning' | 'known';
}

/** One grammar point of the list: the pattern and its meaning; opens the point's card. */
export function GrammarRow({ point, number, onOpen, status }: GrammarRowProps) {
  const { lang } = useI18n();
  return (
    <button className={`vocab-row grammar-row ${status && status !== 'new' ? `grammar-row-${status}` : ''}`} onClick={onOpen}>
      {number !== undefined && <span className="vocab-row-number">{number}</span>}
      <span className="grammar-row-pattern jp-text" lang="ja">{point.pattern}</span>
      <span className="grammar-row-meaning">{inLanguage(point.meaning, lang)}</span>
      <ChevronRight size={16} className="grammar-row-chevron" />
    </button>
  );
}
