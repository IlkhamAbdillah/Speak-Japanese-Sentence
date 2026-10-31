import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { VERB_SOURCE } from '../services/vocab';
import { FrequencyBars } from './VocabRow';
import { useI18n } from '../i18n';

interface VocabInfoDialogProps {
  onClose: () => void;
}

const VOCAB_SOURCE = { name: 'Kotoba Onomatope (Scribd)', url: 'https://www.scribd.com/document/485472399/kotoba-onomatope' };
const ADJECTIVE_SOURCE = { name: 'JLPT Sensei', url: 'https://jlptsensei.com/jlpt-n5-i-adjectives-list/' };
const JLPT_SOURCE = { name: 'open-anki-jlpt-decks', url: 'https://github.com/jamsinclair/open-anki-jlpt-decks' };
const WORD_CLASS_SOURCE = { name: 'JMdict (EDRDG)', url: 'https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project' };
const FREQUENCY_SOURCE = { name: 'wordfreq', url: 'https://github.com/rspeer/wordfreq' };

const link = (source: { name: string; url: string }) => (
  <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a>
);

/**
 * Where the word list comes from and how to read it (the ⓘ button on the Words page).
 * Kept short so it fits without scrolling, also on a phone (user-requested).
 */
export default function VocabInfoDialog({ onClose }: VocabInfoDialogProps) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stripe = (kind: string, label: string): ReactNode => (
    <span className="vocab-info-swatch"><span className={`vocab-stripe vocab-stripe-${kind}`} />{label}</span>
  );

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog vocab-info"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vocab-info-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vocab-info-header">
          <h3 className="dialog-title" id="vocab-info-title">{t('words.info.title')}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t('words.info.close')}>
            <X size={18} />
          </button>
        </div>

        <h4 className="vocab-info-heading">{t('words.info.sourcesTitle')}</h4>
        <ul className="vocab-info-list">
          <li>{t('words.info.sourceVocab')} {link(VOCAB_SOURCE)}</li>
          <li>{t('words.info.sourceVerbs')} {link(VERB_SOURCE)}</li>
          <li>{t('words.info.sourceAdjectives')} {link(ADJECTIVE_SOURCE)}</li>
          <li>{t('words.info.sourceJlpt')} {link(JLPT_SOURCE)}</li>
          <li>{t('words.info.sourceWordClass')} {link(WORD_CLASS_SOURCE)}</li>
          <li>{t('words.info.sourceFrequency')} {link(FREQUENCY_SOURCE)}</li>
        </ul>

        <h4 className="vocab-info-heading">{t('words.info.legendTitle')}</h4>
        <div className="vocab-info-legend">
          <span className="vocab-info-wide">{t('words.info.sections')}</span>
          {stripe('g1', t('words.info.group1'))}
          {stripe('i', t('words.info.adjI'))}
          {stripe('g2', t('words.info.group2'))}
          {stripe('na', t('words.info.adjNa'))}
          {stripe('g3', t('words.info.group3'))}
          <span className="vocab-info-swatch"><FrequencyBars frequency="veryCommon" />{t('words.info.bars')}</span>
          <span className="vocab-info-wide">{t('words.info.usage')}</span>
        </div>
      </div>
    </div>
  );
}
