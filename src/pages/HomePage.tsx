import { useNavigate } from 'react-router-dom';
import {
  Mic,
  BookOpen,
  Target,
  BarChart3,
  ChevronRight,
  Bot,
} from 'lucide-react';
import type { UserSettings, MicPermission } from '../types';
import { isConversationMode } from '../types';
import { useI18n } from '../i18n';
import ModePicker from '../components/ModePicker';
import SessionSetupDialog from '../components/SessionSetupDialog';
import { getLearningStats } from '../services/storage';
import type { LearningStats } from '../services/storage';
import { isSpeechRecognitionSupported, requestMicPermission } from '../services/speech';
import { useState, useEffect, useCallback } from 'react';

interface HomePageProps {
  settings: UserSettings;
  micPermission: MicPermission;
  onMicPermissionChange: (perm: MicPermission) => void;
  onSettingsChange: (settings: UserSettings) => void;
  onStartPractice: () => void;
}

export default function HomePage({
  settings,
  micPermission,
  onMicPermissionChange,
  onSettingsChange,
  onStartPractice,
}: HomePageProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const closeSetup = useCallback(() => setShowSetup(false), []);

  useEffect(() => {
    setStats(getLearningStats());
  }, []);

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

  const isConversation = isConversationMode(settings);

  const startLabel = isConversation
    ? t('home.startConversation')
    : settings.appMode === 'jlpt'
      ? t('home.startMockTest')
      : t('home.startPractice');

  return (
    <div className="app-main">
      {/* Welcome */}
      <section className="welcome-section animate-in">
        <h1 className="welcome-title">
          {t('home.welcomeTitle')}
        </h1>
        <p className="welcome-subtitle">
          {t('home.welcomeSubtitle')}
        </p>
      </section>

      {/* Mic Status */}
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

      {/* Mode selection: pick a mode, then Select opens its options */}
      <section className="start-card mode-select-card animate-in" style={{ animationDelay: '100ms' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
          <BookOpen size={20} style={{ color: 'var(--accent-primary)' }} />
          <h2 className="card-title">
            {t('home.chooseMode')}
          </h2>
        </div>
        <p className="card-subtitle">
          {t('home.chooseModeSubtitle')}
        </p>

        <ModePicker
          appMode={settings.appMode}
          exerciseMode={settings.exerciseMode}
          jlptSection={settings.jlptSection}
          onChange={(partial) => onSettingsChange({ ...settings, ...partial })}
        />

        {!hasValidAuth && (
          <div className="alert alert-warning" style={{ marginBottom: 'var(--space-md)' }}>
            ⚙️ {t('home.apiKeyMissing')}
          </div>
        )}

        {settings.aiProvider === 'ollama' && (
          <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)' }}>
            🦙 {t('home.usingOllama', { model: settings.aiModel, url: settings.ollamaBaseUrl || 'http://localhost:11434/v1' })}
          </div>
        )}

        <div className="start-card-actions">
          <button className="btn btn-secondary btn-lg" onClick={() => navigate('/settings')}>
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
          onSettingsChange={onSettingsChange}
          blockedReason={blockedReason}
          startLabel={startLabel}
          onStart={onStartPractice}
          onClose={closeSetup}
        />
      )}

      {/* Stats */}
      {stats && (
        <section className="animate-in" style={{ animationDelay: '200ms' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
            {t('home.overview')}
          </h3>

          {stats.totalSessions === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📚</div>
              <p className="empty-state-title">
                {t('home.noSessionsTitle')}
              </p>
              <p className="empty-state-text">
                {t('home.noSessionsText')}
              </p>
            </div>
          ) : (
            <>
              <div className="stats-grid" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="stat-card">
                  <div className="stat-value">{stats.totalSessions}</div>
                  <div className="stat-label">
                    <Target size={12} style={{ display: 'inline', marginRight: 4 }} />
                    {t('home.statSessions')}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.totalQuestions}</div>
                  <div className="stat-label">
                    <BookOpen size={12} style={{ display: 'inline', marginRight: 4 }} />
                    {t('home.statQuestions')}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.overallAccuracy}%</div>
                  <div className="stat-label">
                    <BarChart3 size={12} style={{ display: 'inline', marginRight: 4 }} />
                    {t('home.statAccuracy')}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.totalCorrect}</div>
                  <div className="stat-label">
                    {t('home.statCorrect')}
                  </div>
                </div>
              </div>

              {/* Recent Sessions */}
              {stats.recentSessions.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                    <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {t('home.recentSessions')}
                    </h4>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}>
                      {t('home.viewAll')} <ChevronRight size={14} />
                    </button>
                  </div>
                  {stats.recentSessions.map((s) => (
                    <div
                      key={s.sessionId}
                      className="history-item"
                      onClick={() => navigate(`/recap/${s.sessionId}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="history-meta">
                        <span className="history-meta-item">
                          {new Date(s.startedAt).toLocaleDateString()}
                        </span>
                        <span className="badge badge-accent">{s.jlptLevel}</span>
                        <span className="history-meta-item">
                          {s.messageCount !== undefined
                            ? t('common.messageCount', { count: s.messageCount })
                            : `${s.correctCount}/${s.questionCount} (${s.accuracy}%)`}
                        </span>
                      </div>
                      <span className={`badge ${s.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                        {s.status === 'completed'
                          ? t('common.completed')
                          : t('common.incomplete')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
