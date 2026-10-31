import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, BookOpen, ChevronRight, Bot } from 'lucide-react';
import type { UserSettings, MicPermission, AppMode } from '../types';
import { isConversationMode } from '../types';
import { useI18n } from '../i18n';
import ModePicker from '../components/ModePicker';
import SessionSetupDialog from '../components/SessionSetupDialog';
import { isSpeechRecognitionSupported, requestMicPermission } from '../services/speech';
import { aiHostOf } from '../services/ai';

interface ModePageProps {
  /** practice on /practice (Speaking Practice), jlpt on /jlpt (JLPT Mock Test) */
  mode: AppMode;
  settings: UserSettings;
  micPermission: MicPermission;
  onMicPermissionChange: (perm: MicPermission) => void;
  onSettingsChange: (settings: UserSettings) => void;
  onStartPractice: () => void;
}

/** One mode's page: its practice types / test sections, AI Setup, and Select (opens the setup dialog). */
export default function ModePage({
  mode,
  settings: savedSettings,
  micPermission,
  onMicPermissionChange,
  onSettingsChange,
  onStartPractice,
}: ModePageProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [showSetup, setShowSetup] = useState(false);
  const closeSetup = useCallback(() => setShowSetup(false), []);

  // The page decides the mode; it is saved with any change and when the session starts
  const settings: UserSettings = savedSettings.appMode === mode ? savedSettings : { ...savedSettings, appMode: mode };
  const changeSettings = (next: UserSettings) => onSettingsChange({ ...next, appMode: mode });
  const start = () => {
    if (savedSettings.appMode !== mode) onSettingsChange(settings);
    onStartPractice();
  };

  const handleRequestMic = async () => {
    const perm = await requestMicPermission();
    onMicPermissionChange(perm);
  };

  const hasValidAuth = settings.aiProvider === 'ollama' || settings.apiKey.trim().length > 0;
  const blockedReason = !hasValidAuth
    ? t('home.apiKeyMissing')
    : !isSpeechRecognitionSupported()
      ? t('home.speechUnsupported')
      : micPermission === 'granted' || micPermission === 'not-requested'
        ? null
        : t('home.micDenied');

  const startLabel = isConversationMode(settings)
    ? t('home.startConversation')
    : mode === 'jlpt'
      ? t('home.startMockTest')
      : t('home.startPractice');

  return (
    <div className="app-main">
      <section className="welcome-section animate-in">
        <h1 className="welcome-title">{t(mode === 'jlpt' ? 'home.menu.jlpt' : 'home.menu.practice')}</h1>
      </section>

      {!isSpeechRecognitionSupported() && (
        <div className="alert alert-warning" style={{ maxWidth: 560, margin: '0 auto var(--space-lg)' }}>
          ⚠️ {t('home.speechUnsupported')}
        </div>
      )}

      {micPermission === 'denied' && (
        <div className="alert alert-error" style={{ maxWidth: 560, margin: '0 auto var(--space-lg)' }}>
          🎤 {t('home.micDenied')}
        </div>
      )}

      {micPermission === 'not-requested' && isSpeechRecognitionSupported() && (
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
          <button className="btn btn-secondary" onClick={handleRequestMic}>
            <Mic size={16} />
            {t('home.enableMic')}
          </button>
        </div>
      )}

      <section className="start-card mode-select-card animate-in" style={{ animationDelay: '100ms' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
          <BookOpen size={20} style={{ color: 'var(--accent-primary)' }} />
          <h2 className="card-title">{t(mode === 'jlpt' ? 'modes.testSection' : 'modes.practiceType')}</h2>
        </div>
        <p className="card-subtitle">{t(mode === 'jlpt' ? 'home.pickSection' : 'home.pickPractice')}</p>

        <ModePicker
          appMode={mode}
          exerciseMode={settings.exerciseMode}
          jlptSection={settings.jlptSection}
          onChange={(partial) => changeSettings({ ...settings, ...partial })}
        />

        {!hasValidAuth && (
          <div className="alert alert-warning" style={{ marginBottom: 'var(--space-md)' }}>
            {t('home.apiKeyMissing')}
          </div>
        )}

        {hasValidAuth && (
          <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)' }}>
            {settings.aiModel} · {aiHostOf(settings)}
          </div>
        )}

        <div className="start-card-actions">
          <button
            className="btn btn-secondary btn-lg"
            onClick={() => navigate('/settings', { state: { from: mode === 'jlpt' ? '/jlpt' : '/practice' } })}
          >
            <Bot size={18} />
            {t('common.aiSetup')}
          </button>
          <button className="btn btn-primary btn-lg" onClick={() => setShowSetup(true)}>
            {t('home.select')}
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {showSetup && (
        <SessionSetupDialog
          settings={settings}
          onSettingsChange={changeSettings}
          blockedReason={blockedReason}
          startLabel={startLabel}
          onStart={start}
          onClose={closeSetup}
        />
      )}
    </div>
  );
}
