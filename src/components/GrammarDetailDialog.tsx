import { useEffect, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { ChevronLeft, ChevronRight, Settings, Sparkles, Volume2 } from 'lucide-react';
import type { GrammarPoint } from '../services/grammar';
import { inLanguage } from '../services/grammar';
import { isSpeechSynthesisSupported, speakJapanese } from '../services/speech';
import { GrammarSentence } from './GrammarRow';
import type { GrammarProgress } from '../services/grammarProgress';
import { fromNow, isDue, KNOWN_STREAK, reviewStatus } from '../services/review';
import { languageMeta, useI18n } from '../i18n';

interface GrammarDetailDialogProps {
  point: GrammarPoint;
  /** "12 / 73": the point's place among the ones it steps through */
  position?: { index: number; total: number };
  /** How the card got to this point, for the slide: from the next / previous one, or just opened */
  direction: 'next' | 'previous' | null;
  /** Step to the previous / next point of the list (also ← / → and swiping); missing at the ends */
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
  /** Grammar list: the point's practice progress, and its Practice button */
  practice?: {
    progress?: GrammarProgress;
    /** Missing without an AI set up: the button opens AI Setup instead */
    onStart?: () => void;
    onAISetup: () => void;
  };
}

/** Horizontal swipe distance that steps to the next / previous point */
const SWIPE_PX = 50;

/**
 * One grammar point, like the kanji card: the pattern with ‹ ›, its meaning, how it
 * attaches (formation) and the example sentences with the grammar part highlighted and
 * their translation (tap 🔊 to hear one). No close button, like the kanji card: tap
 * outside or press Esc.
 */
export default function GrammarDetailDialog({ point, position, direction, onPrevious, onNext, onClose, practice }: GrammarDetailDialogProps) {
  const { t, lang } = useI18n();
  const canSpeak = isSpeechSynthesisSupported();
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

  const progress = practice?.progress;
  const status = reviewStatus(progress);
  // Fixed while the card is open (it's opened again after a practice)
  const [now] = useState(() => Date.now());
  const progressText = !progress
    ? t('grammar.practice.notPractised')
    : [
      status === 'learning'
        ? `${t('kanjiList.status.learning')} ${progress.streak}/${KNOWN_STREAK}`
        : t(`kanjiList.status.${status}`),
      isDue(progress, now) ? t('kanjiList.dueNow') : t('kanjiList.nextReview', { date: fromNow(progress.dueAt, now, languageMeta(lang).locale) }),
    ].join(' · ');

  // Keyed by the point, so the slide plays again for each point
  const slide = direction ? `kanji-slide-${direction}` : '';

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog kanji-detail grammar-detail"
        role="dialog"
        aria-modal="true"
        aria-label={point.pattern}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={onTouchEnd}
      >
        <div className="kanji-detail-top">
          <span className="badge badge-accent">{point.level}</span>
          {practice ? (
            <span className="kanji-detail-progress" title={progressText}>
              <span className={`kanji-status-dot kanji-status-${status}`} />
              <span className="kanji-detail-progress-text">{progressText}</span>
            </span>
          ) : position && (
            <span className="kanji-detail-progress">
              {t('grammar.position', { current: position.index + 1, total: position.total })}
            </span>
          )}
        </div>

        <div className="kanji-detail-head">
          <button className="btn btn-ghost btn-icon" onClick={onPrevious} disabled={!onPrevious} aria-label={t('grammar.previous')}>
            <ChevronLeft size={20} />
          </button>
          <div key={point.id} className={`grammar-detail-pattern jp-text ${slide}`} lang="ja">{point.pattern}</div>
          <button className="btn btn-ghost btn-icon" onClick={onNext} disabled={!onNext} aria-label={t('grammar.next')}>
            <ChevronRight size={20} />
          </button>
        </div>

        <div key={`${point.id}-body`} className={slide}>
          <div className="kanji-detail-meaning">{inLanguage(point.meaning, lang)}</div>

          <dl className="kanji-detail-readings grammar-detail-fields">
            <dt>{t('grammar.formation')}</dt>
            <dd className="grammar-formation" lang="ja">{point.formation}</dd>
          </dl>

          {/* The practice (AI): the only thing that moves the progress shown above */}
          {practice && (practice.onStart ? (
            <button className="btn btn-primary btn-sm kanji-practice-button" onClick={practice.onStart}>
              <Sparkles size={14} /> {t('grammar.practice.button')}
            </button>
          ) : (
            <button className="btn btn-secondary btn-sm kanji-practice-button" onClick={practice.onAISetup} title={t('home.apiKeyMissing')}>
              <Settings size={14} /> {t('grammar.practice.needsAI')}
            </button>
          ))}

          <div className="grammar-examples">
            <div className="grammar-examples-title">{t('grammar.examples')}</div>
            <ul className="grammar-example-list">
              {point.examples.map((example, i) => (
                <li key={i}>
                  <div className="grammar-example-text">
                    <p className="grammar-example-ja jp-text" lang="ja"><GrammarSentence example={example} /></p>
                    <p className="grammar-example-translation">{inLanguage(example.translation, lang)}</p>
                  </div>
                  {canSpeak && (
                    <button
                      className="btn btn-ghost btn-icon grammar-listen"
                      onClick={() => speakJapanese(example.text)}
                      title={t('words.listen')}
                      aria-label={t('words.listen')}
                    >
                      <Volume2 size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
