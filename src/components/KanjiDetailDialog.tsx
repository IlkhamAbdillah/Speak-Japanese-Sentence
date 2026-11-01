import { useEffect, useRef, useState } from 'react';
import type { ReactNode, TouchEvent } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Play, Volume2 } from 'lucide-react';
import type { KanjiProgress } from '../types';
import type { KanjiEntry } from '../services/kanjiList';
import { examplesFor, plainReading, splitKun, toKatakana } from '../services/kanjiList';
import { fromNow, isDue, kanjiStatus, KNOWN_STREAK } from '../services/kanjiProgress';
import { meaningOf } from '../services/vocab';
import { isSpeechSynthesisSupported, speakJapanese } from '../services/speech';
import { languageMeta, useI18n } from '../i18n';

interface KanjiDetailDialogProps {
  entry: KanjiEntry;
  progress?: KanjiProgress;
  /** How the card got to this kanji, for the slide: from the next / previous one, or just opened */
  direction: 'next' | 'previous' | null;
  /** The example words dropdown (stays open while stepping through kanji) */
  showWords: boolean;
  onShowWordsChange: (open: boolean) => void;
  /** Step to the previous / next kanji of the list (also ← / → and swiping); missing at the ends */
  onPrevious?: () => void;
  onNext?: () => void;
  /** Start the kanji's reading practice; missing when there are no words for it */
  onPractice?: () => void;
  onClose: () => void;
}

/** Kun'yomi shown (some kanji have a dozen; the rest still count for the example words) */
const MAX_KUN = 6;

/** Horizontal swipe distance that steps to the next / previous kanji */
const SWIPE_PX = 50;

/**
 * One kanji, compact enough to fit without scrolling (user-requested): meanings,
 * on'yomi (katakana) and kun'yomi (okurigana dimmed), the learner's progress, and a
 * collapsed list of example words, one per reading first, and the Practice readings
 * button (the kanji's reading practice). Readings and words can be tapped to hear them. Stepping to another kanji slides the content in. No close
 * button (user-requested: it sat where they tapped to step); tap outside or press Esc.
 */
export default function KanjiDetailDialog({
  entry, progress, direction, showWords, onShowWordsChange, onPrevious, onNext, onPractice, onClose,
}: KanjiDetailDialogProps) {
  const { t, lang } = useI18n();
  const canSpeak = isSpeechSynthesisSupported();
  const examples = examplesFor(entry, 4, MAX_KUN);
  const practised = progress?.words ?? [];
  const status = kanjiStatus(progress);
  const [now] = useState(() => Date.now());
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrevious?.();
      else if (e.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrevious, onNext]);

  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) onNext?.();
    else onPrevious?.();
  };

  const reading = (key: string, text: string, label: ReactNode) =>
    canSpeak ? (
      <button key={key} className="kanji-reading" onClick={() => speakJapanese(text)} title={t('kanjiList.listen')}>
        {label}
      </button>
    ) : (
      <span key={key} className="kanji-reading">{label}</span>
    );

  const progressText = !progress
    ? t('kanjiList.notPractised')
    : [
      status === 'learning'
        ? `${t('kanjiList.status.learning')} ${progress.streak}/${KNOWN_STREAK}`
        : t(`kanjiList.status.${status}`),
      isDue(progress, now) ? t('kanjiList.dueNow') : t('kanjiList.nextReview', { date: fromNow(progress.dueAt, now, languageMeta(lang).locale) }),
    ].filter(Boolean).join(' · ');

  // The glyph and the body are keyed by the kanji, so the slide plays again for each kanji
  const slide = direction ? `kanji-slide-${direction}` : '';

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog kanji-detail"
        role="dialog"
        aria-modal="true"
        aria-label={entry.kanji}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={onTouchEnd}
      >
        <div className="kanji-detail-top">
          <span className="badge badge-accent">{entry.level}{entry.unit ? ` · ${t('kanjiList.unit', { unit: entry.unit })}` : ''}</span>
          <span className="kanji-detail-progress" title={progressText}>
            <span className={`kanji-status-dot kanji-status-${status}`} />
            <span className="kanji-detail-progress-text">{progressText}</span>
          </span>
        </div>

        <div className="kanji-detail-head">
          <button className="btn btn-ghost btn-icon" onClick={onPrevious} disabled={!onPrevious} aria-label={t('kanjiList.previous')}>
            <ChevronLeft size={20} />
          </button>
          <div key={entry.kanji} className={`kanji-detail-glyph jp-text kanji-status-${status} ${slide}`} lang="ja">{entry.kanji}</div>
          <button className="btn btn-ghost btn-icon" onClick={onNext} disabled={!onNext} aria-label={t('kanjiList.next')}>
            <ChevronRight size={20} />
          </button>
        </div>

        <div key={entry.kanji} className={`kanji-detail-body ${slide}`}>
          <p className="kanji-detail-meaning">{entry.meanings.join(', ')}</p>
          {lang !== 'en' && <p className="kanji-detail-note">{t('kanjiList.meaningNote')}</p>}

          <dl className="kanji-detail-readings">
            {entry.on.length > 0 && (
              <>
                <dt>{t('kanjiList.onyomi')}</dt>
                <dd className="jp-text" lang="ja">
                  {entry.on.map((r) => reading(r, r, toKatakana(r)))}
                </dd>
              </>
            )}
            {entry.kun.length > 0 && (
              <>
                <dt>{t('kanjiList.kunyomi')}</dt>
                <dd className="jp-text" lang="ja">
                  {entry.kun.slice(0, MAX_KUN).map((r) => {
                    const { stem, okurigana, prefix, suffix } = splitKun(r);
                    return reading(r, plainReading(r), (
                      <>
                        {suffix && <span className="kanji-okurigana">‑</span>}
                        {stem}
                        {okurigana && <span className="kanji-okurigana">{okurigana}</span>}
                        {prefix && <span className="kanji-okurigana">‑</span>}
                      </>
                    ));
                  })}
                </dd>
              </>
            )}
          </dl>

          {/* The reading practice: the only thing that moves the progress shown above */}
          <button className="btn btn-primary btn-sm kanji-practice-button" onClick={onPractice} disabled={!onPractice}>
            {onPractice ? <><Play size={14} /> {t('kanjiList.practice.button')}</> : t('kanjiList.practice.noWords')}
          </button>

          {(examples.length > 0 || practised.length > 0) && (
            <div className="kanji-examples">
              <button
                className="kanji-examples-toggle"
                onClick={() => onShowWordsChange(!showWords)}
                aria-expanded={showWords}
              >
                {t('kanjiList.words')}
                {examples.length > 0 && <span className="kanji-examples-count">{examples.length}</span>}
                <ChevronDown size={14} className={`vocab-advanced-chevron ${showWords ? 'open' : ''}`} />
              </button>
              {showWords && (
                <>
                  <ul className="kanji-words">
                    {examples.map((ex) => (
                      <li key={ex.word.id}>
                        <span className="kanji-word jp-text" lang="ja">{ex.written}</span>
                        {/* The part of the reading that belongs to this kanji is highlighted */}
                        <span className="kanji-word-reading jp-text" lang="ja">
                          {ex.said === ex.written ? '' : ex.start === undefined ? ex.said : (
                            <>
                              {ex.said.slice(0, ex.start)}
                              <mark>{ex.said.slice(ex.start, ex.end)}</mark>
                              {ex.said.slice(ex.end)}
                            </>
                          )}
                        </span>
                        <span className="kanji-word-meaning">{meaningOf(ex.word, lang)}</span>
                        {canSpeak && (
                          <button className="btn btn-ghost btn-icon kanji-word-listen" onClick={() => speakJapanese(ex.said)} aria-label={t('kanjiList.listen')}>
                            <Volume2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {practised.length > 0 && (
                    <p className="kanji-detail-practised">
                      {t('kanjiList.practised')}: <span className="kanji-practised-words" lang="ja">{practised.join('、')}</span>
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
