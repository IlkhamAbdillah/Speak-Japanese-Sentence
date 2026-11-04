import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

interface ConfirmDialogProps {
  title: string;
  text: string;
  confirmLabel: string;
  /** btn-danger for ending a session, btn-primary otherwise */
  confirmClass?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * A Cancel / Confirm dialog driven from the keyboard too (user-requested):
 * ←/→ pick a button (Cancel first), Enter presses it, Esc cancels. While it is
 * open it swallows every key, so the page's own shortcuts (Enter, 1–4, R) don't fire.
 */
export default function ConfirmDialog({ title, text, confirmLabel, confirmClass = 'btn-danger', onCancel, onConfirm }: ConfirmDialogProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<0 | 1>(0);
  const buttons = [useRef<HTMLButtonElement>(null), useRef<HTMLButtonElement>(null)];
  const actions = useRef({ onCancel, onConfirm, selected });
  useEffect(() => {
    actions.current = { onCancel, onConfirm, selected };
  });

  useEffect(() => {
    buttons[selected].current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    // Capture phase: runs before the page's handlers and stops them
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return;
      e.stopPropagation();
      if (e.isComposing) return;
      const { onCancel, onConfirm, selected } = actions.current;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelected(0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelected(1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!e.repeat) (selected === 1 ? onConfirm : onCancel)();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog-title">{title}</h3>
        <p className="dialog-text">{text}</p>
        <div className="dialog-actions">
          <button
            ref={buttons[0]}
            className={`btn btn-secondary ${selected === 0 ? 'dialog-selected' : ''}`}
            onClick={onCancel}
            onFocus={() => setSelected(0)}
          >
            {t('common.cancel')}
          </button>
          <button
            ref={buttons[1]}
            className={`btn ${confirmClass} ${selected === 1 ? 'dialog-selected' : ''}`}
            onClick={onConfirm}
            onFocus={() => setSelected(1)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
