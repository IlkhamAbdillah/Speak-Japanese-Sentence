import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Play } from 'lucide-react';
import { Kbd } from './Kbd';
import { useI18n } from '../i18n';

interface GeneratingScreenProps {
  /** The questions are written: the bar stops and Start turns on */
  ready: boolean;
  /** While writing: the title and the line under it */
  title: string;
  text?: string;
  /** The How to answer card */
  tips: ReactNode;
  onBack: () => void;
  onStart: () => void;
}

/**
 * While the AI writes the questions, and after it until Start (user-requested; every AI
 * feature): the title, a thin moving bar, the How to answer card, and Back · Start
 * (disabled while writing; Enter presses it).
 */
export default function GeneratingScreen({ ready, title, text, tips, onBack, onStart }: GeneratingScreenProps) {
  const { t } = useI18n();
  const onStartRef = useRef(onStart);
  useEffect(() => {
    onStartRef.current = onStart;
  });
  useEffect(() => {
    if (!ready) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat || e.isComposing || e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      onStartRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready]);

  return (
    <div className="app-main">
      <div className="generating-state">
        <p className="empty-state-title generating-title">{ready ? t('practice.readyTitle') : title}</p>
        {!ready && text && <p className="empty-state-text">{text}</p>}
        <div className={`generating-bar ${ready ? 'done' : ''}`} aria-hidden="true" />
        {tips}
        <div className="generating-actions">
          <button className="btn btn-secondary btn-lg" onClick={onBack}>
            {t('common.back')}
          </button>
          <button className="btn btn-primary btn-lg" onClick={onStart} disabled={!ready}>
            {ready ? <Play size={18} /> : <span className="spinner" />}
            {t(ready ? 'practice.startSession' : 'practice.writingQuestions')}
            {ready && <Kbd k="Enter" />}
          </button>
        </div>
      </div>
    </div>
  );
}
