import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Trophy,
  Clock,
  Target,
  BarChart3,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Home,
  History,
  Check,
  X,
  MessageCircle,
  PencilLine,
} from 'lucide-react';
import type { Session } from '../types';
import { getSessionModeLabel } from '../types';
import ChatBubble from '../components/ChatBubble';
import { getSessionById } from '../services/storage';
import { useI18n } from '../i18n';

interface RecapPageProps {
  sessionId?: string;
  onPracticeAgain: () => void;
}

export default function RecapPage({ sessionId: propSessionId, onPracticeAgain }: RecapPageProps) {
  const navigate = useNavigate();
  const { lang, t } = useI18n();
  const params = useParams();
  const id = propSessionId || params.sessionId || '';

  const [session, setSession] = useState<Session | null>(null);
  const [expandedQ, setExpandedQ] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (id) {
      const s = getSessionById(id);
      setSession(s);
    }
  }, [id]);

  if (!session) {
    return (
      <div className="app-main">
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <p className="empty-state-title">
            {t('recap.notFound')}
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            <Home size={16} /> {t('recap.backHome')}
          </button>
        </div>
      </div>
    );
  }

  if (session.conversation) {
    return (
      <ConversationRecap
        session={session}
        onPracticeAgain={onPracticeAgain}
      />
    );
  }

  const correctCount = session.results.filter((r) => r.isCorrect).length;
  const totalQuestions = session.results.length;
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const firstAttemptCorrect = session.results.filter(
    (r) => r.isCorrect && r.attempts.length > 0 && r.attempts[0].isCorrect
  ).length;
  const firstAttemptAccuracy = totalQuestions > 0
    ? Math.round((firstAttemptCorrect / totalQuestions) * 100)
    : 0;
  const totalTimeMs = session.results.reduce((sum, r) => sum + r.totalTimeMs, 0);
  const avgTimeMs = totalQuestions > 0 ? Math.round(totalTimeMs / totalQuestions) : 0;

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const toggleQuestion = (idx: number) => {
    setExpandedQ((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const getPerformanceMessage = () => {
    if (accuracy >= 90) return t('recap.perfOutstanding');
    if (accuracy >= 70) return t('recap.perfGreat');
    if (accuracy >= 50) return t('recap.perfOk');
    return t('recap.perfLow');
  };

  return (
    <div className="app-main" style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div className="recap-header animate-in">
        <h1 className="recap-title">
          {session.status === 'completed'
            ? t('recap.complete')
            : t('recap.title')}
        </h1>
        <p className="recap-subtitle">{getPerformanceMessage()}</p>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid animate-in" style={{ marginBottom: 'var(--space-2xl)', animationDelay: '100ms' }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: accuracy >= 70 ? 'var(--color-success)' : 'var(--color-warning)' }}>
            {accuracy}%
          </div>
          <div className="stat-label">
            <BarChart3 size={12} style={{ display: 'inline', marginRight: 4 }} />
            {t('home.statAccuracy')}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{correctCount}/{totalQuestions}</div>
          <div className="stat-label">
            <Target size={12} style={{ display: 'inline', marginRight: 4 }} />
            {t('home.statCorrect')}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{firstAttemptAccuracy}%</div>
          <div className="stat-label">
            <Trophy size={12} style={{ display: 'inline', marginRight: 4 }} />
            {t('recap.firstTry')}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatDuration(avgTimeMs)}</div>
          <div className="stat-label">
            <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
            {t('recap.avgTime')}
          </div>
        </div>
      </div>

      {/* Session Info */}
      <div className="card animate-in" style={{ marginBottom: 'var(--space-xl)', animationDelay: '150ms' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          <span><strong>{t('recap.level')}:</strong> {session.jlptLevel}</span>
          <span><strong>{t('recap.mode')}:</strong> {getSessionModeLabel(session, lang)}</span>
          <span><strong>{t('recap.duration')}:</strong> {formatDuration(totalTimeMs)}</span>
          <span><strong>{t('recap.date')}:</strong> {new Date(session.startedAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Question Reviews */}
      <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
        {t('recap.questionDetails')}
      </h3>

      {session.results.map((result, idx) => (
        <div key={idx} className="review-item animate-in" style={{ animationDelay: `${200 + idx * 50}ms` }}>
          <div className="review-item-header" onClick={() => toggleQuestion(idx)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <span className={`badge ${result.isCorrect ? 'badge-success' : 'badge-error'}`}>
                {result.isCorrect ? <Check size={12} /> : <X size={12} />}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Q{idx + 1}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>
                {result.question.prompt.length > 60
                  ? result.question.prompt.slice(0, 60) + '...'
                  : result.question.prompt}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                {t('recap.attempts', { count: result.attempts.length })}
              </span>
              {expandedQ.has(idx) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>

          {expandedQ.has(idx) && (
            <div className="review-item-body">
              {result.question.passage && (
                <div className="review-detail">
                  <div className="review-detail-label">{t('recap.readingText')}</div>
                  <div className="reading-passage">{result.question.passage}</div>
                </div>
              )}

              <div className="review-detail">
                <div className="review-detail-label">{t('recap.prompt')}</div>
                <div className="review-detail-value">{result.question.prompt}</div>
              </div>

              <div className="review-detail">
                <div className="review-detail-label">{t('recap.yourAnswer')}</div>
                <div className="review-detail-value jp-text jp-text-sm">
                  {result.finalTranscript || t('common.noAnswer')}
                </div>
              </div>

              <div className="review-detail">
                <div className="review-detail-label">{t('recap.expectedAnswer')}</div>
                <div className="review-detail-value jp-text jp-text-sm" style={{ color: 'var(--accent-primary)' }}>
                  {result.question.expectedAnswer}
                </div>
              </div>

              {result.question.mode === 'kanji' && (
                <div className="review-detail">
                  <div className="review-detail-label">{t('recap.meaning')}</div>
                  <div className="review-detail-value">{result.question.intendedMeaning}</div>
                </div>
              )}

              {result.attempts.length > 0 && (
                <div className="review-detail">
                  <div className="review-detail-label">{t('recap.feedback')}</div>
                  <div className="review-detail-value" style={{ fontSize: 'var(--text-sm)' }}>
                    {result.attempts[result.attempts.length - 1].feedback}
                  </div>
                </div>
              )}

              {result.question.relevantVocabulary.length > 0 && (
                <div className="review-detail">
                  <div className="review-detail-label">{t('recap.vocabulary')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                    {result.question.relevantVocabulary.map((v, i) => (
                      <span key={i} className="badge badge-info" style={{ fontFamily: 'var(--font-jp)' }}>{v}</span>
                    ))}
                  </div>
                </div>
              )}

              {result.question.relevantGrammar.length > 0 && (
                <div className="review-detail">
                  <div className="review-detail-label">{t('recap.grammar')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                    {result.question.relevantGrammar.map((g, i) => (
                      <span key={i} className="badge badge-accent">{g}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', marginTop: 'var(--space-2xl)', flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-lg" onClick={onPracticeAgain}>
          <RotateCcw size={16} /> {t('recap.practiceAgain')}
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/history')}>
          <History size={16} /> {t('common.sessionHistory')}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          <Home size={16} /> {t('common.home')}
        </button>
      </div>
    </div>
  );
}

// ─── Conversation recap ─────────────────────────────────

function ConversationRecap({ session, onPracticeAgain }: {
  session: Session;
  onPracticeAgain: () => void;
}) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const messages = session.conversation?.messages ?? [];
  const userMessages = messages.filter((m) => m.role === 'user');
  const corrected = userMessages.filter((m) => m.correction).length;
  // Unfinished conversations have no end time; fall back to the last message
  const endedAt = session.endedAt ?? messages[messages.length - 1]?.timestamp ?? session.startedAt;
  const durationMs = endedAt - session.startedAt;
  const minutes = Math.max(1, Math.round(durationMs / 60000));

  return (
    <div className="app-main" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="recap-header animate-in">
        <h1 className="recap-title">
          {t('recap.conversationTitle')}
        </h1>
        <p className="recap-subtitle">
          {session.conversation?.topic || t('common.randomTopic')}
        </p>
      </div>

      <div className="stats-grid animate-in" style={{ marginBottom: 'var(--space-2xl)', animationDelay: '100ms' }}>
        <div className="stat-card">
          <div className="stat-value">{userMessages.length}</div>
          <div className="stat-label">
            <MessageCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
            {t('recap.messagesSent')}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: corrected === 0 ? 'var(--color-success)' : 'var(--color-warning)' }}>
            {corrected}
          </div>
          <div className="stat-label">
            <PencilLine size={12} style={{ display: 'inline', marginRight: 4 }} />
            {t('recap.corrections')}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{session.jlptLevel}</div>
          <div className="stat-label">{t('recap.level')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{minutes}m</div>
          <div className="stat-label">
            <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
            {t('recap.duration')}
          </div>
        </div>
      </div>

      <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
        {t('recap.chatTranscript')}
      </h3>
      <div className="chat-messages chat-messages-static">
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} expandCorrection />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', marginTop: 'var(--space-2xl)', flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-lg" onClick={onPracticeAgain}>
          <RotateCcw size={16} /> {t('recap.chatAgain')}
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/history')}>
          <History size={16} /> {t('common.sessionHistory')}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          <Home size={16} /> {t('common.home')}
        </button>
      </div>
    </div>
  );
}
