import { Volume2 } from 'lucide-react';
import type { VocabFrequency } from '../types';
import { VOCAB_FREQUENCIES } from '../types';
import type { VocabEntry } from '../services/vocab';
import { meaningOf } from '../services/vocab';
import { isSpeechSynthesisSupported, speakJapanese } from '../services/speech';
import { useI18n } from '../i18n';

interface VocabRowProps {
  entry: VocabEntry;
  /** Position shown before the word (the word list) */
  number?: number;
  /** The group / い・な stripe and the frequency bars ("Hide details" turns them off) */
  showDetails?: boolean;
}

/** How common a word is, as 4 signal bars (4 = very common, 1 = rare). */
export function FrequencyBars({ frequency }: { frequency: VocabFrequency }) {
  const { t } = useI18n();
  const filled = VOCAB_FREQUENCIES.length - VOCAB_FREQUENCIES.indexOf(frequency);
  const label = t(`words.frequency.${frequency}`);
  return (
    <span className="vocab-bars" title={label} role="img" aria-label={label}>
      {VOCAB_FREQUENCIES.map((_, i) => <span key={i} className={i < filled ? 'on' : ''} />)}
    </span>
  );
}

/** The verb group (1–3) or adjective type (i / na) a stripe colour stands for. */
function stripeOf(entry: Pick<VocabEntry, 'verbGroup' | 'adjType'>): string | null {
  return entry.verbGroup ? `g${entry.verbGroup}` : entry.adjType ?? null;
}

/**
 * One word of the list: the word (and reading), its meaning, related words, a listen
 * button. The JLPT level is the section the row is in; the group / い・な is the colour
 * of the left stripe and how common it is the bars.
 */
export default function VocabRow({ entry, number, showDetails = true }: VocabRowProps) {
  const { t, lang } = useI18n();
  const stripe = stripeOf(entry);
  const stripeLabel = entry.verbGroup
    ? t('words.verbGroup', { group: entry.verbGroup })
    : entry.adjType ? t(entry.adjType === 'i' ? 'words.adjI' : 'words.adjNa') : '';
  return (
    <div className="vocab-row">
      {showDetails && stripe && (
        <span className={`vocab-stripe vocab-stripe-${stripe}`} title={stripeLabel} aria-label={stripeLabel} role="img" />
      )}
      {number !== undefined && <span className="vocab-row-number">{number}</span>}
      <div className="vocab-row-word">
        <span className="vocab-word jp-text">{entry.word}</span>
        {entry.reading && <span className="vocab-reading jp-text">{entry.reading}</span>}
      </div>
      <div className="vocab-row-meaning">
        <span>{meaningOf(entry, lang)}</span>
        {entry.see && (
          <span className="vocab-see">
            {t('words.see')}: <span className="jp-text">{entry.see.join('、')}</span>
          </span>
        )}
      </div>
      <div className="vocab-row-side">
        {/* Hidden, not removed, so hiding the details doesn't shift the columns */}
        <span className={showDetails ? undefined : 'vocab-details-hidden'} aria-hidden={!showDetails}>
          <FrequencyBars frequency={entry.frequency} />
        </span>
        {isSpeechSynthesisSupported() && (
          <button
            className="btn btn-ghost btn-icon vocab-listen"
            onClick={() => speakJapanese(entry.reading ?? entry.word)}
            title={t('words.listen')}
            aria-label={t('words.listen')}
          >
            <Volume2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
