import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n';

interface KanjiInfoDialogProps {
  onClose: () => void;
}

const LEVEL_SOURCE = { name: 'Jonathan Waller (tanos.co.uk)', url: 'http://www.tanos.co.uk/jlpt/' };
const DETAILS_SOURCE = { name: 'KANJIDIC (EDRDG)', url: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project' };
const RADICAL_SOURCE = { name: 'KRADFILE (EDRDG)', url: 'https://www.edrdg.org/krad/kradinf.html' };
const KANJIVG_SOURCE = { name: 'KanjiVG (Ulrich Apel, CC BY-SA 3.0)', url: 'https://kanjivg.tagaini.net' };
const WORDS_SOURCE = { name: 'open-anki-jlpt-decks', url: 'https://github.com/jamsinclair/open-anki-jlpt-decks' };
const FREQUENCY_SOURCE = { name: 'wordfreq', url: 'https://github.com/rspeer/wordfreq' };
const DATA_SOURCE = { name: 'kanji-data', url: 'https://github.com/davidluzgouveia/kanji-data' };

const link = (source: { name: string; url: string }) => (
  <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a>
);

/** Where the kanji list comes from and what the tile colours mean (the ⓘ button on the Kanji page). */
export default function KanjiInfoDialog({ onClose }: KanjiInfoDialogProps) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const swatch = (status: string, label: string) => (
    <span className="vocab-info-swatch"><span className={`kanji-status-dot kanji-status-${status}`} />{label}</span>
  );

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog vocab-info"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kanji-info-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vocab-info-header">
          <h3 className="dialog-title" id="kanji-info-title">{t('kanjiList.info.title')}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t('kanjiList.close')}>
            <X size={18} />
          </button>
        </div>

        <h4 className="vocab-info-heading">{t('kanjiList.info.sourcesTitle')}</h4>
        <ul className="vocab-info-list">
          <li>{t('kanjiList.info.sourceLevels')} {link(LEVEL_SOURCE)}</li>
          <li>{t('kanjiList.info.sourceDetails')} {link(DETAILS_SOURCE)} {t('kanjiList.info.via')} {link(DATA_SOURCE)}</li>
          <li>{t('kanjiList.info.sourceRadicals')} {link(RADICAL_SOURCE)}, {link(KANJIVG_SOURCE)}</li>
          <li>{t('kanjiList.info.sourceOrder')} {link(DETAILS_SOURCE)}</li>
          <li>{t('kanjiList.info.sourceWords')} {link(WORDS_SOURCE)}, {link(FREQUENCY_SOURCE)}</li>
          <li>{t('kanjiList.meaningNote')}</li>
        </ul>

        <h4 className="vocab-info-heading">{t('kanjiList.info.legendTitle')}</h4>
        <div className="vocab-info-legend">
          {swatch('new', t('kanjiList.info.legendNew'))}
          {swatch('learning', t('kanjiList.info.legendLearning'))}
          <span className="vocab-info-wide">{swatch('known', t('kanjiList.info.legendKnown'))}</span>
          <span className="vocab-info-wide">{t('kanjiList.info.legendProgress')}</span>
        </div>
      </div>
    </div>
  );
}
