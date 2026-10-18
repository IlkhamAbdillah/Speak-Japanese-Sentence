import { useEffect, useCallback, useState, useRef } from 'react';
import {
  Mic,
  MicOff,
  Square,
  SkipForward,
  RotateCcw,
  Pause,
  Play,
  X,
  Loader2,
  Check,
  AlertCircle,
  Lightbulb,
  Eye,
  Send,
} from 'lucide-react';
import type { UserSettings } from '../types';
import { useSession, getMaxAttempts } from '../hooks/useSession';
import { getSessionModeLabel, isExamMode, isKanjiMode, isMultipleChoiceMode } from '../types';
import MultipleChoice from '../components/MultipleChoice';
import { isSpeechRecognitionSupported, SILENCE_SUBMIT_MS } from '../services/speech';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n';

interface PracticePageProps {
  settings: UserSettings;
  onFinish: (sessionId: string) => void;
  onExit: () => void;
}

/** How long "Correct!" stays on screen before the next question appears. */
const CORRECT_ADVANCE_MS = 1200;

export default function PracticePage({ settings, onFinish, onExit }: PracticePageProps) {
  const {
    session,
    speechState,
    interimTranscript,
    finalTranscript,
    currentQuestion,
    currentAttempts,
    lastEvaluation,
    isGenerating,
    generationError,
    evaluationError,
    elapsedMs,
    startSession,
    startListening,
    stopListening,
    submitTranscript,
    submitChoice,
    nextQuestion,
    retryQuestion,
    revealAnswer,
    pauseSession,
    resumeSession,
    endSession,
    isPaused,
  } = useSession();

  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  const { lang, t } = useI18n();
  const isExam = isExamMode(settings);
  const isKanji = isKanjiMode(settings);
  const isChoice = isMultipleChoiceMode(settings);
  const maxAttempts = getMaxAttempts(settings);

  // Clear per-question UI state whenever we move on
  const goToNextQuestion = useCallback(() => {
    setShowAnswer(false);
    setEditedTranscript('');
    setSelectedChoice(null);
    nextQuestion();
  }, [nextQuestion]);

  // Start session on mount
  useEffect(() => {
    startSession(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-submit when final transcript arrives
  useEffect(() => {
    if (finalTranscript && speechState === 'processing') {
      setEditedTranscript(finalTranscript);
      submitTranscript(finalTranscript);
    }
  }, [finalTranscript, speechState, submitTranscript]);

  // A correct answer needs no explanation: flash "Correct!" and move straight on.
  // goToNextQuestion changes identity every timer tick, so read it through a ref
  // instead of restarting the delay each time.
  const goToNextQuestionRef = useRef(goToNextQuestion);
  useEffect(() => {
    goToNextQuestionRef.current = goToNextQuestion;
  }, [goToNextQuestion]);

  useEffect(() => {
    if (lastEvaluation?.correct) {
      const timer = setTimeout(() => goToNextQuestionRef.current(), CORRECT_ADVANCE_MS);
      return () => clearTimeout(timer);
    }
  }, [lastEvaluation]);

  // Check session completion
  useEffect(() => {
    if (session?.status === 'completed') {
      onFinish(session.sessionId);
    }
  }, [session?.status, session?.sessionId, onFinish]);

  const handleEndSession = useCallback(() => {
    endSession();
    if (session && session.results.length > 0) {
      onFinish(session.sessionId);
    } else {
      onExit();
    }
  }, [endSession, session, onFinish, onExit]);

  const handleRevealAnswer = () => {
    revealAnswer();
    setShowAnswer(true);
  };

  const handleManualSubmit = () => {
    if (editedTranscript.trim()) {
      submitTranscript(editedTranscript.trim());
    }
  };

  // Format timer
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (isGenerating) {
    return (
      <div className="app-main">
        <div className="empty-state">
          <div className="spinner spinner-lg" style={{ margin: '0 auto var(--space-lg)' }}></div>
          <p className="empty-state-title">
            {t('practice.generatingTitle')}
          </p>
          <p className="empty-state-text">
            {t('practice.generatingText')}
          </p>
        </div>
      </div>
    );
  }

  // Generation error
  if (generationError) {
    return (
      <div className="app-main">
        <div className="empty-state">
          <div className="empty-state-icon">❌</div>
          <p className="empty-state-title">
            {t('practice.generationFailed')}
          </p>
          <div className="alert alert-error" style={{ maxWidth: 500, margin: 'var(--space-md) auto', textAlign: 'left' }}>
            <AlertCircle size={16} />
            <span>{generationError}</span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center', marginTop: 'var(--space-lg)' }}>
            <button className="btn btn-primary" onClick={() => startSession(settings)}>
              <RotateCcw size={16} /> {t('common.retry')}
            </button>
            <button className="btn btn-secondary" onClick={onExit}>
              {t('practice.goBack')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session || !currentQuestion) return null;

  const progress = session.currentQuestionIndex / session.questionCount;
  const questionNum = session.currentQuestionIndex + 1;

  const speechSupported = isSpeechRecognitionSupported();

  // Explanations are only shown for wrong answers: always once the answer is
  // revealed (and always in an exam); otherwise they count as hints and
  // follow the hints setting.
  const showExplanations =
    !!lastEvaluation && (isExam || settings.hintsEnabled || showAnswer);
  // The exam (and multiple choice) shows the answer right away after a wrong answer
  const answerVisible = !!lastEvaluation && (showAnswer || isExam || isChoice);

  const getSpeechStateLabel = () => {
    const labels: Record<string, MessageKey> = {
      idle: 'practice.speech.idle',
      listening: isKanji ? 'practice.speech.listeningKanji' : 'practice.speech.listening',
      processing: 'practice.speech.processing',
      evaluating: 'practice.speech.evaluating',
      correct: 'practice.speech.correct',
      retry: isExam ? 'practice.speech.answered' : 'practice.speech.retry',
      error: 'practice.speech.error',
      unsupported: 'practice.speech.unsupported',
    };
    const key = labels[speechState];
    return key ? t(key, { seconds: SILENCE_SUBMIT_MS / 1000 }) : '';
  };

  return (
    <div className="app-main">
      {/* Session Header */}
      <div className="session-header">
        <div className="session-info">
          <span className="badge badge-accent">{session.jlptLevel}</span>
          <span className="badge badge-info">
            {getSessionModeLabel(session, lang)}
          </span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {t('practice.questionOf', { current: questionNum, total: session.questionCount })}
          </span>
        </div>
        <div className="session-controls">
          <span className="timer">{formatTime(elapsedMs)}</span>
          <button
            className="btn btn-ghost btn-icon"
            onClick={isPaused ? resumeSession : pauseSession}
            title={isPaused ? t('practice.resume') : t('practice.pause')}
          >
            {isPaused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setShowConfirmEnd(true)}
            title={t('practice.endSession')}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-bar" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="progress-bar-fill" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* Paused overlay */}
      {isPaused && (
        <div className="empty-state">
          <div className="empty-state-icon">⏸️</div>
          <p className="empty-state-title">{t('practice.paused')}</p>
          <button className="btn btn-primary" onClick={resumeSession}>
            <Play size={16} /> {t('practice.resume')}
          </button>
        </div>
      )}

      {!isPaused && (
        <div className="game-area animate-in">
          {/* Question Card */}
          <div className="question-card">
            {isKanji ? (
              <>
                <p className="question-context" style={{ marginBottom: 'var(--space-sm)' }}>
                  {t('practice.kanjiInstruction')}
                </p>
                <p className="kanji-display">{currentQuestion.prompt}</p>
              </>
            ) : isChoice ? (
              <>
                {currentQuestion.passage && (
                  <div className="reading-passage">{currentQuestion.passage}</div>
                )}
                <p className="question-context" style={{ marginBottom: 'var(--space-sm)' }}>
                  {t('practice.readingInstruction')}
                </p>
                <p className="question-prompt jp-text">{currentQuestion.prompt}</p>
              </>
            ) : (
              <>
                <p className="question-prompt">{currentQuestion.prompt}</p>
                {currentQuestion.context && (
                  <p className="question-context">{currentQuestion.context}</p>
                )}
              </>
            )}
            {currentAttempts.length > 0 && maxAttempts > 1 && (
              <span className="badge badge-warning" style={{ marginTop: 'var(--space-sm)' }}>
                {t('practice.attempt', { current: currentAttempts.length, max: maxAttempts })}
              </span>
            )}
          </div>

          {/* Multiple choice (reading): pick one, then submit */}
          {isChoice && currentQuestion.choices && (
            <>
              <MultipleChoice
                choices={currentQuestion.choices}
                selected={selectedChoice}
                onSelect={setSelectedChoice}
                result={lastEvaluation && selectedChoice !== null && currentQuestion.correctChoice !== undefined
                  ? { chosen: selectedChoice, correct: currentQuestion.correctChoice }
                  : null}
              />
              {!lastEvaluation && (
                <button
                  className="btn btn-primary btn-lg"
                  disabled={selectedChoice === null}
                  onClick={() => selectedChoice !== null && submitChoice(selectedChoice)}
                >
                  <Send size={16} /> {t('practice.submitChoice')}
                </button>
              )}
            </>
          )}

          {!isChoice && (
            <>
            {/* Answer: type right away, or use the mic below */}
            {!lastEvaluation && speechState !== 'evaluating' && speechState !== 'processing' ? (
              <div className="answer-input-row">
                <input
                  className={`form-input answer-input ${speechState === 'listening' ? 'listening' : ''}`}
                  autoFocus
                  placeholder={speechState === 'listening'
                    ? t('common.listening')
                    : isKanji
                      ? t('practice.kanjiPlaceholder')
                      : t('practice.answerPlaceholder')}
                  value={speechState === 'listening' ? interimTranscript : editedTranscript}
                  readOnly={speechState === 'listening'}
                  onChange={(e) => setEditedTranscript(e.target.value)}
                  onKeyDown={(e) => {
                    // Don't submit while an IME (kana → kanji) conversion is in progress
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleManualSubmit();
                  }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleManualSubmit}
                  disabled={!editedTranscript.trim() || speechState === 'listening'}
                  title={t('practice.submit')}
                >
                  <Send size={16} />
                </button>
              </div>
            ) : (
              <div className="transcript-display">
                {editedTranscript || finalTranscript || t('common.noAnswer')}
              </div>
            )}

            {/* Kanji: give up and see the answer without guessing */}
            {isKanji && !lastEvaluation && speechState !== 'evaluating' && speechState !== 'processing' && (
              <button className="btn btn-ghost btn-sm" onClick={handleRevealAnswer}>
                <Eye size={14} /> {t('practice.showAnswer')}
              </button>
            )}

            {/* Mic Controls */}
            <div className="game-controls">
              {speechSupported ? (
                <button
                  className={`mic-button ${speechState === 'listening' ? 'listening' : ''} ${speechState === 'correct' ? 'correct' : ''}`}
                  onClick={speechState === 'listening' ? stopListening : startListening}
                  title={speechState === 'listening'
                    ? t('common.cancelRecording')
                    : t('common.speak')}
                  disabled={
                    speechState === 'evaluating' ||
                    speechState === 'processing' ||
                    isPaused ||
                    !!lastEvaluation
                  }
                >
                  {speechState === 'listening' ? (
                    <Square size={28} />
                  ) : speechState === 'evaluating' || speechState === 'processing' ? (
                    <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite' }} />
                  ) : speechState === 'correct' ? (
                    <Check size={28} />
                  ) : (
                    <Mic size={28} />
                  )}
                </button>
              ) : (
                <button className="mic-button" disabled>
                  <MicOff size={28} />
                </button>
              )}
              <span className="speech-state-label">{getSpeechStateLabel()}</span>
            </div>
            </>
          )}

          {/* Evaluation Error */}
          {evaluationError && (
            <div className="alert alert-error" style={{ maxWidth: 500, width: '100%' }}>
              <AlertCircle size={16} />
              <span>{evaluationError}</span>
            </div>
          )}

          {/* Correct: brief confirmation, then auto-advance (see effect above) */}
          {lastEvaluation?.correct && (
            <div className="correct-flash animate-in">
              <Check size={20} />
              {questionNum >= session.questionCount
                ? t('practice.correctDone')
                : t('practice.correctNext')}
            </div>
          )}

          {/* Wrong answer feedback */}
          {lastEvaluation && !lastEvaluation.correct && (
            <div style={{ width: '100%', maxWidth: 600 }} className="animate-in">
              <div className="feedback-panel feedback-incorrect">
                <div className="feedback-title">
                  <RotateCcw size={20} /> {currentAttempts.length === 0
                    ? t('practice.answerRevealed')
                    : isExam || isChoice
                      ? t('practice.incorrect')
                      : t('practice.notQuite')}
                </div>
                {lastEvaluation.feedback && <p className="feedback-text">{lastEvaluation.feedback}</p>}

                {/* Grammar/Vocab Notes — these explain the fix, so treat them as hints on wrong answers */}
                {showExplanations && (lastEvaluation.grammarNotes.length > 0 || lastEvaluation.vocabularyNotes.length > 0) && (
                  <div className="feedback-notes">
                    {lastEvaluation.grammarNotes.map((note, i) => (
                      <div key={`g-${i}`} className="feedback-note">
                        <span>📝</span> <span>{note}</span>
                      </div>
                    ))}
                    {lastEvaluation.vocabularyNotes.map((note, i) => (
                      <div key={`v-${i}`} className="feedback-note">
                        <span>📖</span> <span>{note}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Hint */}
                {lastEvaluation.hint && settings.hintsEnabled && !answerVisible && (
                  <div className="hint-box">
                    <Lightbulb size={14} style={{ display: 'inline', marginRight: 4 }} />
                    {lastEvaluation.hint}
                  </div>
                )}
              </div>

              {/* Reveal Answer (multiple choice marks the right option in the list instead) */}
              {answerVisible && !isChoice && (
                <div className="answer-reveal">
                  <div className="answer-reveal-label">
                    {isKanji
                      ? t('practice.reading')
                      : t('practice.expectedAnswer')}
                  </div>
                  <div className="answer-reveal-text">
                    {isKanji ? `${currentQuestion.prompt}（${currentQuestion.expectedAnswer}）` : currentQuestion.expectedAnswer}
                  </div>
                  {isKanji && (
                    <>
                      {currentQuestion.alternativeAnswers && currentQuestion.alternativeAnswers.length > 0 && (
                        <div className="answer-reveal-extra">
                          {t('practice.alsoRead')}
                          <span className="jp-text">{currentQuestion.alternativeAnswers.join('、')}</span>
                        </div>
                      )}
                      <div className="answer-reveal-extra">
                        {t('practice.meaning')}{currentQuestion.intendedMeaning}
                      </div>
                      {currentQuestion.example && (
                        <div className="answer-reveal-extra">
                          <div className="jp-text">{currentQuestion.example.japanese}</div>
                          <div>{currentQuestion.example.translation}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center', marginTop: 'var(--space-lg)' }}>
                {lastEvaluation.nextAction === 'retry' ? (
                  <button className="btn btn-primary btn-lg" onClick={() => {
                    retryQuestion();
                    setEditedTranscript('');
                    setShowAnswer(false);
                  }}>
                    <RotateCcw size={16} /> {t('practice.tryAgain')}
                  </button>
                ) : (
                  <button className="btn btn-primary btn-lg" onClick={goToNextQuestion}>
                    <SkipForward size={16} />
                    {questionNum >= session.questionCount
                      ? t('practice.finish')
                      : t('practice.nextQuestion')}
                  </button>
                )}
                {!answerVisible && (
                  // In kanji mode showing the answer means giving up on the question
                  <button className="btn btn-ghost" onClick={isKanji ? handleRevealAnswer : () => setShowAnswer(true)}>
                    <Eye size={16} /> {t('practice.showAnswer')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* End Session Dialog */}
      {showConfirmEnd && (
        <div className="dialog-overlay" onClick={() => setShowConfirmEnd(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog-title">
              {t('practice.endTitle')}
            </h3>
            <p className="dialog-text">
              {session.results.length > 0
                ? t('practice.endWithResults', { count: session.results.length })
                : t('practice.endWithoutResults')}
            </p>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirmEnd(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-danger" onClick={handleEndSession}>
                {t('practice.endConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
