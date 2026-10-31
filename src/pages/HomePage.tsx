import { useNavigate } from 'react-router-dom';
import { BookOpen, Target, BarChart3, ChevronRight } from 'lucide-react';
import type { MessageKey } from '../i18n';
import { useI18n } from '../i18n';
import { getLearningStats } from '../services/storage';
import type { LearningStats } from '../services/storage';
import { useState, useEffect } from 'react';

// Landing page menu: one card per section of the app
const HOME_MENU: { path: string; glyph: string; label: MessageKey }[] = [
  { path: '/words', glyph: '語', label: 'home.menu.words' },
  { path: '/kanji', glyph: '字', label: 'home.menu.kanji' },
  { path: '/practice', glyph: '話', label: 'home.menu.practice' },
  { path: '/jlpt', glyph: '試', label: 'home.menu.jlpt' },
];

/** Landing page: the four sections, then the learning overview. */
export default function HomePage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [stats, setStats] = useState<LearningStats | null>(null);

  useEffect(() => {
    setStats(getLearningStats());
  }, []);

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

      {/* The four sections of the app */}
      <nav className="home-menu animate-in" style={{ animationDelay: '100ms' }}>
        {HOME_MENU.map((item) => (
          <button key={item.path} className="home-menu-card" onClick={() => navigate(item.path)}>
            <span className="home-menu-glyph" lang="ja" aria-hidden="true">{item.glyph}</span>
            <span className="home-menu-label">{t(item.label)}</span>
            <ChevronRight size={18} className="home-menu-chevron" />
          </button>
        ))}
      </nav>

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
