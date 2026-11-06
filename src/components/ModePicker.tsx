import { useEffect, useRef } from 'react';
import type { AppMode, ExerciseMode, JLPTSection, UserSettings } from '../types';
import { EXERCISE_MODES, JLPT_SECTIONS } from '../types';
import { useI18n } from '../i18n';

interface ModePickerProps {
  appMode: AppMode;
  exerciseMode: ExerciseMode;
  jlptSection: JLPTSection;
  onChange: (partial: Partial<UserSettings>) => void;
  /** Enter: the page's Select button */
  onConfirm?: () => void;
  /** ←/→ and Enter are on (off while a dialog is open) */
  keyboard?: boolean;
}

// Only labels here: each mode's description is shown in the setup dialog
type Option = { key: string; label: string; active: boolean; select: () => void };

/** The cards of one mode's page: practice types on /practice, test sections on /jlpt. */
/**
 * ←/→ move the selection (wrapping round) and Enter presses Select (user-requested).
 * Keys typed into a text field, or Enter on another focused button, are left alone.
 */
export default function ModePicker({ appMode, exerciseMode, jlptSection, onChange, onConfirm, keyboard = false }: ModePickerProps) {
  const { t } = useI18n();
  const options: Option[] = appMode === 'practice'
    ? EXERCISE_MODES.map((mode) => ({
        key: mode,
        label: t(`modes.exercise.${mode}.label`),
        active: exerciseMode === mode,
        select: () => onChange({ exerciseMode: mode }),
      }))
    : JLPT_SECTIONS.map((section) => ({
        key: section,
        label: t(`modes.jlptSection.${section}.label`),
        active: jlptSection === section,
        select: () => onChange({ jlptSection: section }),
      }));

  const latest = useRef({ options, onConfirm });
  useEffect(() => {
    latest.current = { options, onConfirm };
  });
  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.isComposing) return;
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      const { options, onConfirm } = latest.current;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const current = Math.max(0, options.findIndex((o) => o.active));
        const step = e.key === 'ArrowRight' ? 1 : -1;
        e.preventDefault();
        options[(current + step + options.length) % options.length].select();
      } else if (e.key === 'Enter' && onConfirm && !e.repeat) {
        // Another focused button (Continue, Settings…) keeps its own Enter
        if (target instanceof HTMLButtonElement && !target.classList.contains('mode-card')) return;
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboard]);

  return (
    <div className="mode-picker">
      <div className="mode-cards">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`mode-card ${o.active ? 'active' : ''}`}
            aria-pressed={o.active}
            onClick={o.select}
          >
            <div className="mode-card-title">{o.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
