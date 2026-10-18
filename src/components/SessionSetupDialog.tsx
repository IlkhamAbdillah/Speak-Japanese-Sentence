import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, X } from 'lucide-react';
import type { UserSettings } from '../types';
import { JLPT_LEVELS, READING_QUESTION_COUNT, hasAttemptChoice, isConversationMode, isMultipleChoiceMode } from '../types';
import { useI18n } from '../i18n';

interface SessionSetupDialogProps {
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
  /** Why the session can't start (missing API key, no speech support…), if it can't */
  blockedReason: string | null;
  startLabel: string;
  onStart: () => void;
  onClose: () => void;
}

const QUESTION_COUNTS = [5, 10, 15, 20];
/** 1 attempt = no retries; the explanation is shown right away */
const MAX_ATTEMPTS = [1, 2, 3, 5, 10];

/** Opened from the home page after picking a mode: the options for that mode, then Start. */
export default function SessionSetupDialog({
  settings,
  onSettingsChange,
  blockedReason,
  startLabel,
  onStart,
  onClose,
}: SessionSetupDialogProps) {
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const update = (partial: Partial<UserSettings>) => onSettingsChange({ ...settings, ...partial });

  const isConversation = isConversationMode(settings);
  const isReading = isMultipleChoiceMode(settings);

  const title = settings.appMode === 'practice'
    ? t(`modes.exercise.${settings.exerciseMode}.label`)
    : `JLPT · ${t(`modes.jlptSection.${settings.jlptSection}.label`)}`;
  const desc = settings.appMode === 'practice'
    ? t(`modes.exercise.${settings.exerciseMode}.desc`)
    : t(`modes.jlptSection.${settings.jlptSection}.desc`);

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog setup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="setup-dialog-header">
          <div>
            <h3 className="dialog-title" id="setup-dialog-title">{title}</h3>
            <p className="setup-dialog-desc">{desc}</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t('common.cancel')}>
            <X size={18} />
          </button>
        </div>

        <div className="setup-field">
          <div className="setup-field-label">{t('setup.jlptLevel')}</div>
          <div className="option-group">
            {JLPT_LEVELS.map((level) => (
              <button
                key={level}
                className={`option-pill ${settings.jlptLevel === level ? 'active' : ''}`}
                onClick={() => update({ jlptLevel: level })}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {!isConversation && (
          <div className="setup-field">
            <div className="setup-field-label">{t('setup.questionCount')}</div>
            {isReading ? (
              <p className="setup-field-help">{t('setup.readingQuestionCount', { count: READING_QUESTION_COUNT })}</p>
            ) : (
              <div className="option-group">
                {QUESTION_COUNTS.map((n) => (
                  <button
                    key={n}
                    className={`option-pill ${settings.questionCount === n ? 'active' : ''}`}
                    onClick={() => update({ questionCount: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {hasAttemptChoice(settings) && (
          <div className="setup-field">
            <div className="setup-field-label">{t('setup.maxAttempts')}</div>
            <div className="option-group">
              {MAX_ATTEMPTS.map((n) => (
                <button
                  key={n}
                  className={`option-pill ${settings.maxAttempts === n ? 'active' : ''}`}
                  onClick={() => update({ maxAttempts: n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isConversation && (
          <div className="setup-field">
            <label className="setup-checkbox">
              <input
                type="checkbox"
                checked={settings.hintsEnabled}
                onChange={(e) => update({ hintsEnabled: e.target.checked })}
              />
              {t('setup.hints')}
            </label>
          </div>
        )}

        {blockedReason && (
          <div className="alert alert-warning setup-dialog-alert">
            <span style={{ flex: 1 }}>{blockedReason}</span>
            {settings.aiProvider !== 'ollama' && !settings.apiKey.trim() && (
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/settings')}>
                {t('common.aiSetup')}
              </button>
            )}
          </div>
        )}

        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={onStart} disabled={!!blockedReason}>
            <Play size={16} /> {startLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
