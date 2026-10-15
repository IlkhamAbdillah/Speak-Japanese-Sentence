import type { AppMode, ExerciseMode, InstructionLanguage, UserSettings } from '../types';
import {
  APP_MODE_LABELS,
  APP_MODE_DESCRIPTIONS,
  EXERCISE_MODE_LABELS,
  EXERCISE_MODE_DESCRIPTIONS,
  isConversationMode,
} from '../types';

interface ModePickerProps {
  appMode: AppMode;
  exerciseMode: ExerciseMode;
  examMode: boolean;
  lang: InstructionLanguage;
  onChange: (partial: Partial<UserSettings>) => void;
  /** 'cards' shows descriptions (settings page); 'pills' is compact (home page) */
  variant?: 'cards' | 'pills';
}

const APP_MODES = Object.keys(APP_MODE_LABELS) as AppMode[];
const EXERCISE_MODES = Object.keys(EXERCISE_MODE_LABELS) as ExerciseMode[];

export default function ModePicker({ appMode, exerciseMode, examMode, lang, onChange, variant = 'cards' }: ModePickerProps) {
  // Conversation has no questions to grade, so it can't be an exam
  const examToggle = !isConversationMode({ appMode, exerciseMode }) && (
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
          {APP_MODES.map((mode) => (
            <button
              key={mode}
              className={`option-pill ${appMode === mode ? 'active' : ''}`}
              onClick={() => onChange({ appMode: mode })}
              title={APP_MODE_DESCRIPTIONS[mode][lang]}
            >
              {APP_MODE_LABELS[mode][lang]}
            </button>
          ))}
        </div>
        {appMode === 'practice' && (
          <div className="option-group mode-picker-sub">
            {EXERCISE_MODES.map((mode) => (
              <button
                key={mode}
                className={`option-pill option-pill-sm ${exerciseMode === mode ? 'active' : ''}`}
                onClick={() => onChange({ exerciseMode: mode })}
                title={EXERCISE_MODE_DESCRIPTIONS[mode][lang]}
              >
                {EXERCISE_MODE_LABELS[mode][lang]}
              </button>
            ))}
          </div>
        )}
        <p className="mode-picker-desc">
          {appMode === 'practice'
            ? EXERCISE_MODE_DESCRIPTIONS[exerciseMode][lang]
            : APP_MODE_DESCRIPTIONS[appMode][lang]}
        </p>
        {examToggle}
      </div>
    );
  }

  return (
    <div className="mode-picker">
      <div className="mode-cards">
        {APP_MODES.map((mode) => (
          <div
            key={mode}
            className={`mode-card ${appMode === mode ? 'active' : ''}`}
            onClick={() => onChange({ appMode: mode })}
          >
            <div className="mode-card-title">{APP_MODE_LABELS[mode][lang]}</div>
            <div className="mode-card-desc">{APP_MODE_DESCRIPTIONS[mode][lang]}</div>
          </div>
        ))}
      </div>

      {appMode === 'practice' && (
        <>
          <h3 className="mode-picker-subtitle">
            {lang === 'id' ? 'Jenis Latihan' : 'Practice Type'}
          </h3>
          <div className="mode-cards">
            {EXERCISE_MODES.map((mode) => (
              <div
                key={mode}
                className={`mode-card ${exerciseMode === mode ? 'active' : ''}`}
                onClick={() => onChange({ exerciseMode: mode })}
              >
                <div className="mode-card-title">{EXERCISE_MODE_LABELS[mode][lang]}</div>
                <div className="mode-card-desc">{EXERCISE_MODE_DESCRIPTIONS[mode][lang]}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {examToggle}
    </div>
  );
}
