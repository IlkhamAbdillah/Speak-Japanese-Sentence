import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, BookOpen, ChevronRight, ExternalLink, Settings } from 'lucide-react';
import type { UserSettings, MicPermission, AppMode } from '../types';
import { isConversationMode, hasAISetup } from '../types';
import type { MessageKey } from '../i18n';
import { useI18n } from '../i18n';
import ModePicker from '../components/ModePicker';
import { Kbd } from '../components/Kbd';
import SessionSetupDialog from '../components/SessionSetupDialog';
import { isSpeechRecognitionSupported, requestMicPermission } from '../services/speech';
import { aiHostOf } from '../services/ai';
import ContinueSessionCard from '../components/ContinueSessionCard';
import type { ContinueSession } from '../components/ContinueSessionCard';

// Other free JLPT sites on the JLPT Mock Test page, split into practice tests and study material (user-requested)
const JLPT_LINKS: { title: MessageKey; links: { url: string; name: string }[] }[] = [
  {
    title: 'jlptLinks.tests',
    links: [
      { url: 'https://bunpro.jp/jlpt_practice_tests', name: 'Bunpro' },
      { url: 'https://mazii.net/id-ID/learning-hub/exam?type=jlpt&level=5', name: 'Mazii' },
    ],
  },
  {
    title: 'jlptLinks.materials',
    links: [
      { url: 'https://japanesetest4you.com/', name: 'Japanesetest4you' },
    ],
  },
];

interface ModePageProps {
  /** practice on /practice (Speaking Practice), jlpt on /jlpt (JLPT Mock Test) */
  mode: AppMode;
  settings: UserSettings;
  micPermission: MicPermission;
  onMicPermissionChange: (perm: MicPermission) => void;
  onSettingsChange: (settings: UserSettings) => void;
  onStartPractice: () => void;
  /** A session of this mode left in progress */
  savedSession?: ContinueSession;
}

/** One mode's page: its practice types / test sections and Select (opens the setup dialog). The AI is set up in Settings (header). */
export default function ModePage({
  mode,
  settings: savedSettings,
  micPermission,
  onMicPermissionChange,
  onSettingsChange,
  onStartPractice,
  savedSession,
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

  const hasValidAuth = hasAISetup(settings);
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

      {savedSession && <ContinueSessionCard {...savedSession} />}

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
          onConfirm={() => setShowSetup(true)}
          keyboard={!showSetup}
        />

        {!hasValidAuth && (
          <div className="alert alert-warning setup-dialog-alert" style={{ marginBottom: 'var(--space-md)' }}>
            <span style={{ flex: 1 }}>{t('home.apiKeyMissing')}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/settings', { state: { from: mode === 'jlpt' ? '/jlpt' : '/practice' } })}>
              <Settings size={14} /> {t('header.settings')}
            </button>
          </div>
        )}

        {hasValidAuth && (
          <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)' }}>
            {settings.aiModel} · {aiHostOf(settings)}
          </div>
        )}

        <div className="start-card-actions">
          <button className="btn btn-primary btn-lg" onClick={() => setShowSetup(true)}>
            {t('home.select')}
            <ChevronRight size={18} />
            <Kbd k="Enter" />
          </button>
        </div>
      </section>

      {/* JLPT Mock Test: more free practice tests elsewhere (user-requested) */}
      {mode === 'jlpt' && (
        <section className="start-card jlpt-links animate-in" style={{ animationDelay: '150ms' }}>
          <h2 className="card-title">{t('jlptLinks.title')}</h2>
          {JLPT_LINKS.map((group) => (
            <div key={group.title} className="jlpt-links-group">
              <h3 className="jlpt-links-heading">{t(group.title)}</h3>
              <div className="jlpt-links-list">
                {group.links.map((link) => (
                  <a key={link.url} className="jlpt-link" href={link.url} target="_blank" rel="noreferrer">
                    <span className="jlpt-link-label">{link.name}</span>
                    <ExternalLink size={16} />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

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
