import type { AppMode, ExerciseMode, JLPTSection, UserSettings } from '../types';
import { EXERCISE_MODES, JLPT_SECTIONS } from '../types';
import { useI18n } from '../i18n';

interface ModePickerProps {
  appMode: AppMode;
  exerciseMode: ExerciseMode;
  jlptSection: JLPTSection;
  onChange: (partial: Partial<UserSettings>) => void;
}

// Only labels here: each mode's description is shown in the setup dialog
type Option = { key: string; label: string; active: boolean; select: () => void };

/** The cards of one mode's page: practice types on /practice, test sections on /jlpt. */
export default function ModePicker({ appMode, exerciseMode, jlptSection, onChange }: ModePickerProps) {
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
