import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { MessageKey } from '../i18n';
import { useI18n } from '../i18n';

interface GrammarInfoDialogProps {
  onClose: () => void;
}

// The abbreviations used in "How it attaches" (no Japanese examples: they made the rows uneven, user-requested)
const ABBREVIATIONS: [string, MessageKey][] = [
  ['N', 'grammar.info.noun'],
  ['A', 'grammar.info.adjI'],
  ['Na', 'grammar.info.adjNa'],
  ['V-dict', 'grammar.info.vDict'],
  ['V-masu stem', 'grammar.info.vMasu'],
  ['V-て / V-ta', 'grammar.info.vTe'],
  ['V-nai', 'grammar.info.vNai'],
  ['V-ba', 'grammar.info.vBa'],
  ['V-vol', 'grammar.info.vVol'],
  ['plain form', 'grammar.info.plain'],
];

/** Where the grammar list comes from and how to read "How it attaches" (the ⓘ button). Short, so it fits on a phone. */
export default function GrammarInfoDialog({ onClose }: GrammarInfoDialogProps) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog vocab-info"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grammar-info-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vocab-info-header">
          <h3 className="dialog-title" id="grammar-info-title">{t('grammar.info.title')}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t('words.info.close')}>
            <X size={18} />
          </button>
        </div>

        <h4 className="vocab-info-heading">{t('words.info.sourcesTitle')}</h4>
        <ul className="vocab-info-list">
          <li>{t('grammar.info.source')}</li>
          <li>{t('grammar.info.levels')}</li>
        </ul>

        <h4 className="vocab-info-heading">{t('grammar.info.legendTitle')}</h4>
        <dl className="grammar-info-legend">
          {ABBREVIATIONS.map(([abbr, label]) => (
            <div key={abbr}>
              <dt>{abbr}</dt>
              <dd>{t(label)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
