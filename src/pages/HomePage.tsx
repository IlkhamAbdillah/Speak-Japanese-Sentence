import { useNavigate } from 'react-router-dom';
import {
  Mic,
  Play,
  Settings,
  BookOpen,
  Target,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import type { UserSettings, MicPermission } from '../types';
import { JLPT_DESCRIPTIONS, isConversationMode, isExamMode } from '../types';
import ModePicker from '../components/ModePicker';
import { getLearningStats } from '../services/storage';
import type { LearningStats } from '../services/storage';
import { isSpeechRecognitionSupported, requestMicPermission } from '../services/speech';
import { useState, useEffect } from 'react';

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
  const [stats, setStats] = useState<LearningStats | null>(null);

  useEffect(() => {
    setStats(getLearningStats());
  }, []);

  const handleRequestMic = async () => {
    const perm = await requestMicPermission();
    onMicPermissionChange(perm);
  };

  const hasValidAuth = settings.aiProvider === 'ollama' || settings.apiKey.trim().length > 0;
  const canStart =
    hasValidAuth &&
    (micPermission === 'granted' || micPermission === 'not-requested') &&
    isSpeechRecognitionSupported();

  const lang = settings.instructionLanguage;
  const isConversation = isConversationMode(settings);
  const isExam = isExamMode(settings);

  const startLabel = isConversation
    ? (lang === 'id' ? 'Mulai Percakapan' : 'Start Conversation')
    : isExam
      ? (lang === 'id' ? 'Mulai Ujian' : 'Start Exam')
      : settings.appMode === 'kanji'
        ? (lang === 'id' ? 'Mulai Kanji' : 'Start Kanji')
        : (lang === 'id' ? 'Mulai Latihan' : 'Start Practice');

  return (
    <div className="app-main">
      {/* Welcome */}
      <section className="welcome-section animate-in">
        <h1 className="welcome-title">
          {lang === 'id' ? 'Siap Berbicara Bahasa Jepang?' : 'Ready to Speak Japanese?'}
        </h1>
        <p className="welcome-subtitle">
          {lang === 'id'
            ? 'Latihan satu kalimat dalam satu waktu, tingkatkan bahasa Jepang Anda, dan lacak progres belajar.'
            : 'Practice one sentence at a time, improve your Japanese, and track your progress.'}
        </p>
      </section>

      {/* Mic Status */}
      {!isSpeechRecognitionSupported() && (
        <div className="alert alert-warning" style={{ maxWidth: 560, margin: '0 auto var(--space-lg)' }}>
          ⚠️ {lang === 'id'
            ? 'Browser Anda tidak mendukung Speech Recognition. Gunakan Chrome atau Edge untuk fitur penuh.'
            : 'Your browser does not support Speech Recognition. Use Chrome or Edge for full features.'}
        </div>
      )}

      {micPermission === 'denied' && (
        <div className="alert alert-error" style={{ maxWidth: 560, margin: '0 auto var(--space-lg)' }}>
          🎤 {lang === 'id'
            ? 'Akses mikrofon ditolak. Silakan izinkan akses mikrofon di pengaturan browser Anda.'
            : 'Microphone access denied. Please allow microphone access in your browser settings.'}
        </div>
      )}

      {micPermission === 'not-requested' && isSpeechRecognitionSupported() && (
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
          <button className="btn btn-secondary" onClick={handleRequestMic}>
            <Mic size={16} />
            {lang === 'id' ? 'Aktifkan Mikrofon' : 'Enable Microphone'}
          </button>
        </div>
      )}

      {/* Start Card */}
      <section className="start-card animate-in" style={{ animationDelay: '100ms' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
          <BookOpen size={20} style={{ color: 'var(--accent-primary)' }} />
          <h2 className="card-title">
            {lang === 'id' ? 'Mulai Latihan Berbicara' : 'Start Speaking Practice'}
          </h2>
        </div>
        <p className="card-subtitle">
          {lang === 'id'
            ? 'Latih kemampuan berbicara bahasa Jepang dengan evaluasi AI.'
            : 'Practice your Japanese speaking skills with AI evaluation.'}
        </p>

        <ModePicker
          variant="pills"
          appMode={settings.appMode}
          exerciseMode={settings.exerciseMode}
          examMode={settings.examMode}
          lang={lang}
          onChange={(partial) => onSettingsChange({ ...settings, ...partial })}
        />

        <div className="start-card-config">
          <span className="badge badge-accent">
            {settings.jlptLevel}
          </span>
          {!isConversation && (
            <span className="badge badge-info">
              {settings.questionCount} {lang === 'id' ? 'soal' : 'questions'}
            </span>
          )}
          {isExam && (
            <span className="badge badge-warning">
              {lang === 'id' ? 'Ujian · 1 kali jawab' : 'Exam · 1 attempt'}
            </span>
          )}
        </div>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
          {JLPT_DESCRIPTIONS[settings.jlptLevel][lang]}
        </p>

        {!settings.apiKey && settings.aiProvider !== 'ollama' && (
          <div className="alert alert-warning" style={{ marginBottom: 'var(--space-md)' }}>
            ⚙️ {lang === 'id'
              ? 'API key belum dikonfigurasi. Buka Settings untuk mengaturnya.'
              : 'API key not configured. Go to Settings to set it up.'}
          </div>
        )}

        {settings.aiProvider === 'ollama' && (
          <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)' }}>
            🦙 {lang === 'id'
              ? `Menggunakan Ollama (${settings.aiModel}) di ${settings.ollamaBaseUrl || 'http://localhost:11434/v1'}`
              : `Using Ollama (${settings.aiModel}) at ${settings.ollamaBaseUrl || 'http://localhost:11434/v1'}`}
          </div>
        )}

        <div className="start-card-actions">
          <button
            className="btn btn-primary btn-lg"
            disabled={!canStart}
            onClick={onStartPractice}
          >
            <Play size={18} />
            {startLabel}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/settings')}
          >
            <Settings size={16} />
            {lang === 'id' ? 'Konfigurasi' : 'Configure'}
          </button>
        </div>
      </section>

      {/* Stats */}
      {stats && (
        <section className="animate-in" style={{ animationDelay: '200ms' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
            {lang === 'id' ? 'Ringkasan Belajar' : 'Learning Overview'}
          </h3>

          {stats.totalSessions === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📚</div>
              <p className="empty-state-title">
                {lang === 'id' ? 'Belum ada sesi latihan' : 'No practice sessions yet'}
              </p>
              <p className="empty-state-text">
                {lang === 'id'
                  ? 'Mulai sesi pertama Anda untuk melihat statistik di sini!'
                  : 'Start your first session to see stats here!'}
              </p>
            </div>
          ) : (
            <>
              <div className="stats-grid" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="stat-card">
                  <div className="stat-value">{stats.totalSessions}</div>
                  <div className="stat-label">
                    <Target size={12} style={{ display: 'inline', marginRight: 4 }} />
                    {lang === 'id' ? 'Sesi' : 'Sessions'}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.totalQuestions}</div>
                  <div className="stat-label">
                    <BookOpen size={12} style={{ display: 'inline', marginRight: 4 }} />
                    {lang === 'id' ? 'Soal' : 'Questions'}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.overallAccuracy}%</div>
                  <div className="stat-label">
                    <BarChart3 size={12} style={{ display: 'inline', marginRight: 4 }} />
                    {lang === 'id' ? 'Akurasi' : 'Accuracy'}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.totalCorrect}</div>
                  <div className="stat-label">
                    {lang === 'id' ? 'Benar' : 'Correct'}
                  </div>
                </div>
              </div>

              {/* Recent Sessions */}
              {stats.recentSessions.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                    <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {lang === 'id' ? 'Sesi Terakhir' : 'Recent Sessions'}
                    </h4>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}>
                      {lang === 'id' ? 'Lihat Semua' : 'View All'} <ChevronRight size={14} />
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
                            ? `💬 ${s.messageCount} ${lang === 'id' ? 'pesan' : 'messages'}`
                            : `${s.correctCount}/${s.questionCount} (${s.accuracy}%)`}
                        </span>
                      </div>
                      <span className={`badge ${s.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                        {s.status === 'completed'
                          ? (lang === 'id' ? 'Selesai' : 'Completed')
                          : (lang === 'id' ? 'Belum Selesai' : 'Incomplete')}
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
