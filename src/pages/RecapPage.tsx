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
  ListX,
  Check,
  X,
  MessageCircle,
  PencilLine,
  Lightbulb,
} from 'lucide-react';
import type { Session, QuestionResult } from '../types';
import { getSessionModeLabel, APP_MODES, JLPT_SECTIONS } from '../types';
import ChatBubble from '../components/ChatBubble';
import { getSessionById } from '../services/storage';
import { useI18n } from '../i18n';

interface RecapPageProps {
  sessionId?: string;
  onPracticeAgain: () => void;
  /** Practise the questions answered wrong again, without generating new ones */
  onRetryWrong: (session: Session) => void;
}

/** Right on the first attempt, without hints or looking at the answer. */
const isUnaided = (r: QuestionResult) =>
  r.isCorrect && !!r.attempts[0]?.isCorrect && !r.hintsUsed && !r.revealedAnswer;

const unique = (items: string[]) => [...new Set(items.map((i) => i.trim()).filter(Boolean))];

export default function RecapPage({ sessionId: propSessionId, onPracticeAgain, onRetryWrong }: RecapPageProps) {
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
  const firstAttemptCorrect = session.results.filter(isUnaided).length;
  const wrongCount = totalQuestions - correctCount;
  // Sessions from modes that no longer exist can't be practised again
  const canRetryWrong = wrongCount > 0 && (APP_MODES as string[]).includes(session.appMode ?? 'practice') &&
    (session.appMode !== 'jlpt' || (!!session.jlptSection && JLPT_SECTIONS.includes(session.jlptSection)));
  const story = session.story;
  const grammarPracticed = unique(session.results.flatMap((r) => r.question.relevantGrammar));
  const vocabToReview = unique(session.results.filter((r) => !isUnaided(r)).flatMap((r) => r.question.relevantVocabulary));
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

      {/* Story: the whole text with its Japanese translation, and what to review */}
      {story && (
        <div className="card story-recap animate-in" style={{ marginBottom: 'var(--space-xl)', animationDelay: '175ms' }}>
          <h3 className="card-title">
            {t('recap.wholeStory')}{story.title ? `: ${story.title}` : ''}
          </h3>
          <div className="story-recap-summary">
            <span className="badge badge-success">{t('recap.correctUnaided')}: {firstAttemptCorrect}</span>
            <span className="badge badge-warning">{t('recap.correctHelped')}: {correctCount - firstAttemptCorrect}</span>
            <span className="badge badge-error">{t('recap.wrong')}: {wrongCount}</span>
          </div>
          {story.paragraphs.map((paragraph, pi) => (
            <div key={pi} className="story-recap-paragraph">
              {story.paragraphs.length > 1 && (
                <div className="review-detail-label">{t('recap.paragraph', { number: pi + 1 })}</div>
              )}
              <p className="story-recap-source">{paragraph.map((s) => s.source).join(' ')}</p>
              <p className="story-recap-jp jp-text">{paragraph.map((s) => s.expectedAnswer).join('')}</p>
            </div>
          ))}
          {grammarPracticed.length > 0 && (
            <div className="review-detail">
              <div className="review-detail-label">{t('recap.grammarPracticed')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                {grammarPracticed.map((g) => (
                  <span key={g} className="badge badge-accent">{g}</span>
                ))}
              </div>
            </div>
          )}
          {vocabToReview.length > 0 && (
            <div className="review-detail">
              <div className="review-detail-label">{t('recap.vocabReview')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                {vocabToReview.map((v) => (
                  <span key={v} className="badge badge-info" style={{ fontFamily: 'var(--font-jp)' }}>{v}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Question Reviews */}
      <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
        {t(story ? 'recap.sentenceDetails' : 'recap.questionDetails')}
      </h3>

      {session.results.map((result, idx) => {
        const last = result.attempts[result.attempts.length - 1];
        return (
        <div key={idx} className="review-item animate-in" style={{ animationDelay: `${200 + idx * 50}ms` }}>
          <div className="review-item-header" onClick={() => toggleQuestion(idx)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <span className={`badge ${result.isCorrect ? 'badge-success' : 'badge-error'}`}>
                {result.isCorrect ? <Check size={12} /> : <X size={12} />}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                {result.question.paragraphIndex !== undefined && result.question.sentenceIndex !== undefined
                  ? t('recap.sentenceLabel', {
                      paragraph: result.question.paragraphIndex + 1,
                      sentence: result.question.sentenceIndex + 1,
                    })
                  : `Q${idx + 1}`}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>
                {result.question.prompt.length > 60
                  ? result.question.prompt.slice(0, 60) + '...'
                  : result.question.prompt}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              {!!result.hintsUsed && (
                <span title={t('recap.hintUsed')} style={{ color: 'var(--color-info)', display: 'inline-flex' }}>
                  <Lightbulb size={12} />
                </span>
              )}
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

              {last?.correctedAnswer && (
                <div className="review-detail">
                  <div className="review-detail-label">
                    {last.isCorrect ? t('recap.naturalVersion') : t('recap.correction')}
                  </div>
                  <div className="review-detail-value jp-text jp-text-sm">{last.correctedAnswer}</div>
                </div>
              )}

              {last?.alternatives && last.alternatives.length > 0 && (
                <div className="review-detail">
                  <div className="review-detail-label">{t('recap.alternatives')}</div>
                  {last.alternatives.map((a, i) => (
                    <div key={i} className="review-detail-value jp-text jp-text-sm">{a}</div>
                  ))}
                </div>
              )}

              {result.question.mode === 'kanji' && (
                <div className="review-detail">
                  <div className="review-detail-label">{t('recap.meaning')}</div>
                  <div className="review-detail-value">{result.question.intendedMeaning}</div>
                </div>
              )}

              {last && (
                <div className="review-detail">
                  <div className="review-detail-label">{t('recap.feedback')}</div>
                  <div className="review-detail-value" style={{ fontSize: 'var(--text-sm)' }}>
                    {last.feedback}
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
        );
      })}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', marginTop: 'var(--space-2xl)', flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-lg" onClick={onPracticeAgain}>
          <RotateCcw size={16} /> {t('recap.practiceAgain')}
        </button>
        {canRetryWrong && (
          <button className="btn btn-secondary btn-lg" onClick={() => onRetryWrong(session)}>
            <RotateCcw size={16} /> {t('recap.retryWrong')} ({wrongCount})
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => navigate('/mistakes')}>
          <ListX size={16} /> {t('header.mistakes')}
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
        <button className="btn btn-secondary" onClick={() => navigate('/mistakes')}>
          <ListX size={16} /> {t('header.mistakes')}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          <Home size={16} /> {t('common.home')}
        </button>
      </div>
    </div>
  );
}
