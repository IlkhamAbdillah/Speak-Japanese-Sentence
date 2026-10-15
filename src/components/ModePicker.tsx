import type { AppMode, ExerciseMode, InstructionLanguage, JLPTSection, UserSettings } from '../types';
import {
  APP_MODE_LABELS,
  APP_MODE_DESCRIPTIONS,
  EXERCISE_MODE_LABELS,
  EXERCISE_MODE_DESCRIPTIONS,
  JLPT_SECTION_LABELS,
  JLPT_SECTION_DESCRIPTIONS,
  canUseExamMode,
} from '../types';

interface ModePickerProps {
  appMode: AppMode;
  exerciseMode: ExerciseMode;
  jlptSection: JLPTSection;
  examMode: boolean;
  lang: InstructionLanguage;
  onChange: (partial: Partial<UserSettings>) => void;
  /** 'cards' shows descriptions (settings page); 'pills' is compact (home page) */
  variant?: 'cards' | 'pills';
}

const APP_MODES = Object.keys(APP_MODE_LABELS) as AppMode[];
const EXERCISE_MODES = Object.keys(EXERCISE_MODE_LABELS) as ExerciseMode[];
const JLPT_SECTIONS = Object.keys(JLPT_SECTION_LABELS) as JLPTSection[];

type Option = { key: string; label: string; desc: string; active: boolean; select: () => void };

export default function ModePicker({
  appMode,
  exerciseMode,
  jlptSection,
  examMode,
  lang,
  onChange,
  variant = 'cards',
}: ModePickerProps) {
  const modeOptions: Option[] = APP_MODES.map((mode) => ({
    key: mode,
    label: APP_MODE_LABELS[mode][lang],
    desc: APP_MODE_DESCRIPTIONS[mode][lang],
    active: appMode === mode,
    select: () => onChange({ appMode: mode }),
  }));

  // The second row depends on the mode: practice types, or JLPT test sections
  const subOptions: Option[] = appMode === 'practice'
    ? EXERCISE_MODES.map((mode) => ({
        key: mode,
        label: EXERCISE_MODE_LABELS[mode][lang],
        desc: EXERCISE_MODE_DESCRIPTIONS[mode][lang],
        active: exerciseMode === mode,
        select: () => onChange({ exerciseMode: mode }),
      }))
    : JLPT_SECTIONS.map((section) => ({
        key: section,
        label: JLPT_SECTION_LABELS[section][lang],
        desc: JLPT_SECTION_DESCRIPTIONS[section][lang],
        active: jlptSection === section,
        select: () => onChange({ jlptSection: section }),
      }));
  const subTitle = appMode === 'practice'
    ? (lang === 'id' ? 'Jenis Latihan' : 'Practice Type')
    : (lang === 'id' ? 'Bagian Tes' : 'Test Section');

  const examToggle = canUseExamMode({ appMode, exerciseMode, jlptSection }) && (
    <label className="exam-toggle">
      <input
        type="checkbox"
        checked={examMode}
        onChange={(e) => onChange({ examMode: e.target.checked })}
      />
      <span>
        <strong>{lang === 'id' ? 'Mode Ujian' : 'Exam mode'}</strong>
        {' — '}
        {lang === 'id'
          ? 'hanya 1 kali jawab per soal, penjelasan langsung muncul setelah menjawab'
          : 'only 1 attempt per question; the explanation appears right after you answer'}
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
