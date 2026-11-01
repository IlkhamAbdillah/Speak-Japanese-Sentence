import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, X } from 'lucide-react';
import type { UserSettings } from '../types';
import {
  JLPT_LEVELS,
  READING_QUESTION_COUNT,
  STORY_PARAGRAPHS,
  STORY_TOPICS,
  STORY_TENSES,
  STORY_CUSTOM_TOPIC_MAX_LENGTH,
  TRANSLATION_FORMATS,
  hasAttemptChoice,
  isConversationMode,
  isKanjiMode,
  isMultipleChoiceMode,
  isStoryMode,
} from '../types';
import { useI18n } from '../i18n';
import { getCurriculum } from '../services/kanjiCurriculum';

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
  const isTranslation = settings.appMode === 'practice' && settings.exerciseMode === 'translation';
  const isStory = isStoryMode(settings);
  const missingCustomTopic = isStory && settings.storyTopic === 'custom' && !settings.storyCustomTopic.trim();

  // Kanji: where the level's kanji list comes from (no progress here: that is the Kanji page's practice)
  const isKanji = isKanjiMode(settings);
  const curriculum = getCurriculum(settings.jlptLevel);

  const title = settings.appMode === 'practice'
    ? t(`modes.exercise.${settings.exerciseMode}.label`)
    : `JLPT · ${t(`modes.jlptSection.${settings.jlptSection}.label`)}`;
  const desc = isStory
    ? t('setup.storyDesc')
    : settings.appMode === 'practice'
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

        {isTranslation && (
          <div className="setup-field">
            <div className="setup-field-label">{t('setup.format')}</div>
            <div className="option-group">
              {TRANSLATION_FORMATS.map((format) => (
                <button
                  key={format}
                  className={`option-pill ${settings.translationFormat === format ? 'active' : ''}`}
                  onClick={() => update({ translationFormat: format })}
                >
                  {t(format === 'story' ? 'setup.formatStory' : 'setup.formatSentences')}
                </button>
              ))}
            </div>
          </div>
        )}

        {isStory && (
          <>
            <div className="setup-field">
              <div className="setup-field-label">{t('setup.paragraphs')}</div>
              <div className="option-group">
                {STORY_PARAGRAPHS.map((n) => (
                  <button
                    key={n}
                    className={`option-pill ${settings.storyParagraphs === n ? 'active' : ''}`}
                    onClick={() => update({ storyParagraphs: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="setup-field">
              <div className="setup-field-label" id="story-topic-label">{t('setup.topic')}</div>
              <select
                aria-labelledby="story-topic-label"
                className="form-select"
                value={settings.storyTopic}
                onChange={(e) => update({ storyTopic: e.target.value as typeof settings.storyTopic })}
              >
                {STORY_TOPICS.map((topic) => (
                  <option key={topic} value={topic}>{t(`story.topics.${topic}`)}</option>
                ))}
              </select>
              {settings.storyTopic === 'custom' && (
                <input
                  className="form-input story-custom-topic"
                  autoFocus
                  maxLength={STORY_CUSTOM_TOPIC_MAX_LENGTH}
                  aria-label={t('story.topics.custom')}
                  placeholder={t('setup.customTopicPlaceholder')}
                  value={settings.storyCustomTopic}
                  onChange={(e) => update({ storyCustomTopic: e.target.value })}
                />
              )}
            </div>
            <div className="setup-field">
              <div className="setup-field-label">{t('setup.tense')}</div>
              <div className="option-group">
                {STORY_TENSES.map((tense) => (
                  <button
                    key={tense}
                    className={`option-pill ${settings.storyTense === tense ? 'active' : ''}`}
                    onClick={() => update({ storyTense: tense })}
                  >
                    {t(`story.tenses.${tense}`)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {!isConversation && !isStory && (
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

        {isKanji && (
          <p className="setup-field-help">{t('setup.kanjiSource', { source: curriculum.source })}</p>
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
          <button className="btn btn-primary" onClick={onStart} disabled={!!blockedReason || missingCustomTopic}>
            <Play size={16} /> {startLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
