import type { AppMode, ExerciseMode, JLPTSection, UserSettings } from '../types';
import { APP_MODES, EXERCISE_MODES, JLPT_SECTIONS, canUseExamMode } from '../types';
import { useI18n } from '../i18n';

interface ModePickerProps {
  appMode: AppMode;
  exerciseMode: ExerciseMode;
  jlptSection: JLPTSection;
  examMode: boolean;
  onChange: (partial: Partial<UserSettings>) => void;
  /** 'cards' shows descriptions (settings page); 'pills' is compact (home page) */
  variant?: 'cards' | 'pills';
}

type Option = { key: string; label: string; desc: string; active: boolean; select: () => void };

export default function ModePicker({
  appMode,
  exerciseMode,
  jlptSection,
  examMode,
  onChange,
  variant = 'cards',
}: ModePickerProps) {
  const { t } = useI18n();
  const modeOptions: Option[] = APP_MODES.map((mode) => ({
    key: mode,
    label: t(`modes.app.${mode}.label`),
    desc: t(`modes.app.${mode}.desc`),
    active: appMode === mode,
    select: () => onChange({ appMode: mode }),
  }));

  // The second row depends on the mode: practice types, or JLPT test sections
  const subOptions: Option[] = appMode === 'practice'
    ? EXERCISE_MODES.map((mode) => ({
        key: mode,
        label: t(`modes.exercise.${mode}.label`),
        desc: t(`modes.exercise.${mode}.desc`),
        active: exerciseMode === mode,
        select: () => onChange({ exerciseMode: mode }),
      }))
    : JLPT_SECTIONS.map((section) => ({
        key: section,
        label: t(`modes.jlptSection.${section}.label`),
        desc: t(`modes.jlptSection.${section}.desc`),
        active: jlptSection === section,
        select: () => onChange({ jlptSection: section }),
      }));
  const subTitle = appMode === 'practice' ? t('modes.practiceType') : t('modes.testSection');

  const examToggle = canUseExamMode({ appMode, exerciseMode, jlptSection }) && (
    <label className="exam-toggle">
      <input
        type="checkbox"
        checked={examMode}
        onChange={(e) => onChange({ examMode: e.target.checked })}
      />
      <span>
        <strong>{t('modes.examToggle')}</strong>
        {' — '}
        {t('modes.examToggleDesc')}
      </span>
    </label>
  );

  if (variant === 'pills') {
    return (
      <div className="mode-picker">
        <div className="option-group">
          {modeOptions.map((o) => (
            <button key={o.key} className={`option-pill ${o.active ? 'active' : ''}`} onClick={o.select} title={o.desc}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="option-group mode-picker-sub">
          {subOptions.map((o) => (
            <button key={o.key} className={`option-pill option-pill-sm ${o.active ? 'active' : ''}`} onClick={o.select} title={o.desc}>
              {o.label}
            </button>
          ))}
        </div>
        <p className="mode-picker-desc">{subOptions.find((o) => o.active)?.desc}</p>
        {examToggle}
      </div>
    );
  }

  const cards = (options: Option[]) => (
    <div className="mode-cards">
      {options.map((o) => (
        <div key={o.key} className={`mode-card ${o.active ? 'active' : ''}`} onClick={o.select}>
          <div className="mode-card-title">{o.label}</div>
          <div className="mode-card-desc">{o.desc}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="mode-picker">
      {cards(modeOptions)}
      <h3 className="mode-picker-subtitle">{subTitle}</h3>
      {cards(subOptions)}
      {examToggle}
    </div>
  );
}
