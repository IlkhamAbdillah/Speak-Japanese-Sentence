import { useEffect, useCallback, useState } from 'react';
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
import { useSession } from '../hooks/useSession';
import { EXERCISE_MODE_LABELS } from '../types';
import { isSpeechRecognitionSupported } from '../services/speech';

interface PracticePageProps {
  settings: UserSettings;
  onFinish: (sessionId: string) => void;
  onExit: () => void;
}

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
    nextQuestion,
    retryQuestion,
    pauseSession,
    resumeSession,
    endSession,
    isPaused,
  } = useSession();

  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);

  const lang = settings.instructionLanguage;

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

  // Auto-advance on correct (if enabled)
  useEffect(() => {
    if (settings.autoAdvance && speechState === 'correct' && lastEvaluation?.correct) {
      const timer = setTimeout(() => {
        nextQuestion();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [settings.autoAdvance, speechState, lastEvaluation, nextQuestion]);

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
            {lang === 'id' ? 'Membuat soal latihan...' : 'Generating practice questions...'}
          </p>
          <p className="empty-state-text">
            {lang === 'id'
              ? 'AI sedang menyiapkan soal berdasarkan konfigurasi Anda.'
              : 'AI is preparing questions based on your configuration.'}
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
            {lang === 'id' ? 'Gagal membuat soal' : 'Failed to generate questions'}
          </p>
          <div className="alert alert-error" style={{ maxWidth: 500, margin: 'var(--space-md) auto', textAlign: 'left' }}>
            <AlertCircle size={16} />
            <span>{generationError}</span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center', marginTop: 'var(--space-lg)' }}>
            <button className="btn btn-primary" onClick={() => startSession(settings)}>
              <RotateCcw size={16} /> {lang === 'id' ? 'Coba Lagi' : 'Retry'}
            </button>
            <button className="btn btn-secondary" onClick={onExit}>
              {lang === 'id' ? 'Kembali' : 'Go Back'}
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

  const getSpeechStateLabel = () => {
    const labels: Record<string, { en: string; id: string }> = {
      idle: { en: 'Tap to speak', id: 'Ketuk untuk berbicara' },
      listening: { en: 'Listening...', id: 'Mendengarkan...' },
      processing: { en: 'Processing...', id: 'Memproses...' },
      evaluating: { en: 'Evaluating...', id: 'Mengevaluasi...' },
      correct: { en: 'Correct!', id: 'Benar!' },
      retry: { en: 'Try again', id: 'Coba lagi' },
      error: { en: 'Error occurred', id: 'Terjadi kesalahan' },
      unsupported: { en: 'Not supported', id: 'Tidak didukung' },
    };
    return labels[speechState]?.[lang] || '';
  };

  return (
    <div className="app-main">
      {/* Session Header */}
      <div className="session-header">
        <div className="session-info">
          <span className="badge badge-accent">{session.jlptLevel}</span>
          <span className="badge badge-info">
            {EXERCISE_MODE_LABELS[session.mode][lang]}
          </span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {lang === 'id' ? `Soal ${questionNum} dari ${session.questionCount}` : `Question ${questionNum} of ${session.questionCount}`}
          </span>
        </div>
        <div className="session-controls">
          <span className="timer">{formatTime(elapsedMs)}</span>
          <button
            className="btn btn-ghost btn-icon"
            onClick={isPaused ? resumeSession : pauseSession}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setShowConfirmEnd(true)}
            title={lang === 'id' ? 'Akhiri Sesi' : 'End Session'}
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
          <p className="empty-state-title">{lang === 'id' ? 'Sesi Dijeda' : 'Session Paused'}</p>
          <button className="btn btn-primary" onClick={resumeSession}>
            <Play size={16} /> {lang === 'id' ? 'Lanjutkan' : 'Resume'}
          </button>
        </div>
      )}

      {!isPaused && (
        <div className="game-area animate-in">
          {/* Question Card */}
          <div className="question-card">
            <p className="question-prompt">{currentQuestion.prompt}</p>
            {currentQuestion.context && (
              <p className="question-context">{currentQuestion.context}</p>
            )}
            {currentAttempts.length > 0 && (
              <span className="badge badge-warning" style={{ marginTop: 'var(--space-sm)' }}>
                {lang === 'id' ? `Percobaan ${currentAttempts.length}/${settings.maxAttempts}` : `Attempt ${currentAttempts.length}/${settings.maxAttempts}`}
              </span>
            )}
          </div>

          {/* Transcript Display */}
          <div className={`transcript-display ${interimTranscript && !finalTranscript ? 'interim' : ''} ${!interimTranscript && !finalTranscript && !editedTranscript ? 'empty' : ''}`}>
            {speechState === 'listening' && interimTranscript
              ? interimTranscript
              : editedTranscript || finalTranscript
                ? editedTranscript || finalTranscript
                : lang === 'id'
                  ? 'Jawaban Anda akan muncul di sini...'
                  : 'Your answer will appear here...'}
          </div>

          {/* Manual Edit */}
          {(speechState === 'idle' || speechState === 'retry' || speechState === 'error') && !lastEvaluation && (
            <div style={{ width: '100%', maxWidth: 500 }}>
              {isEditingTranscript ? (
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <input
                    className="form-input"
                    style={{ fontFamily: 'var(--font-jp)' }}
                    placeholder={lang === 'id' ? 'Ketik jawaban dalam bahasa Jepang...' : 'Type answer in Japanese...'}
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleManualSubmit}
                    disabled={!editedTranscript.trim()}
                  >
                    <Send size={16} />
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setIsEditingTranscript(true)}
                  style={{ margin: '0 auto', display: 'flex' }}
                >
                  {lang === 'id' ? '⌨️ Atau ketik jawaban' : '⌨️ Or type your answer'}
                </button>
              )}
            </div>
          )}

          {/* Mic Controls */}
          <div className="game-controls">
            {speechSupported ? (
              <button
                className={`mic-button ${speechState === 'listening' ? 'listening' : ''} ${speechState === 'correct' ? 'correct' : ''}`}
                onClick={speechState === 'listening' ? stopListening : startListening}
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

          {/* Evaluation Error */}
          {evaluationError && (
            <div className="alert alert-error" style={{ maxWidth: 500, width: '100%' }}>
              <AlertCircle size={16} />
              <span>{evaluationError}</span>
            </div>
          )}

          {/* Evaluation Feedback */}
          {lastEvaluation && (
            <div style={{ width: '100%', maxWidth: 600 }} className="animate-in">
              <div className={`feedback-panel ${lastEvaluation.correct ? 'feedback-correct' : 'feedback-incorrect'}`}>
                <div className="feedback-title">
                  {lastEvaluation.correct ? (
                    <><Check size={20} /> {lang === 'id' ? 'Benar! 🎉' : 'Correct! 🎉'}</>
                  ) : (
                    <><RotateCcw size={20} /> {lang === 'id' ? 'Belum tepat' : 'Not quite right'}</>
                  )}
                </div>
                <p className="feedback-text">{lastEvaluation.feedback}</p>

                {/* Grammar/Vocab Notes */}
                {(lastEvaluation.grammarNotes.length > 0 || lastEvaluation.vocabularyNotes.length > 0) && (
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
                {lastEvaluation.hint && !lastEvaluation.correct && settings.hintsEnabled && (
                  <div className="hint-box">
                    <Lightbulb size={14} style={{ display: 'inline', marginRight: 4 }} />
                    {lastEvaluation.hint}
                  </div>
                )}
              </div>

              {/* Reveal Answer */}
              {showAnswer && (
                <div className="answer-reveal">
                  <div className="answer-reveal-label">
                    {lang === 'id' ? 'Jawaban yang diharapkan' : 'Expected answer'}
                  </div>
                  <div className="answer-reveal-text">{currentQuestion.expectedAnswer}</div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center', marginTop: 'var(--space-lg)' }}>
                {lastEvaluation.correct ? (
                  <button className="btn btn-success btn-lg" onClick={nextQuestion}>
                    <SkipForward size={16} />
                    {questionNum >= session.questionCount
                      ? (lang === 'id' ? 'Selesai!' : 'Finish!')
                      : (lang === 'id' ? 'Soal Berikutnya' : 'Next Question')}
                  </button>
                ) : (
                  <>
                    {currentAttempts.length < settings.maxAttempts ? (
                      <button className="btn btn-primary btn-lg" onClick={() => {
                        retryQuestion();
                        setEditedTranscript('');
                        setIsEditingTranscript(false);
                        setShowAnswer(false);
                      }}>
                        <RotateCcw size={16} /> {lang === 'id' ? 'Coba Lagi' : 'Try Again'}
                      </button>
                    ) : (
                      <button className="btn btn-primary btn-lg" onClick={nextQuestion}>
                        <SkipForward size={16} />
                        {questionNum >= session.questionCount
                          ? (lang === 'id' ? 'Selesai!' : 'Finish!')
                          : (lang === 'id' ? 'Soal Berikutnya' : 'Next Question')}
                      </button>
                    )}
                    {!showAnswer && (
                      <button className="btn btn-ghost" onClick={() => setShowAnswer(true)}>
                        <Eye size={16} /> {lang === 'id' ? 'Lihat Jawaban' : 'Show Answer'}
                      </button>
                    )}
                  </>
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
              {lang === 'id' ? 'Akhiri Sesi?' : 'End Session?'}
            </h3>
            <p className="dialog-text">
              {session.results.length > 0
                ? (lang === 'id'
                  ? `Anda sudah menyelesaikan ${session.results.length} soal. Sesi akan disimpan sebagai sesi yang belum selesai.`
                  : `You've completed ${session.results.length} questions. The session will be saved as incomplete.`)
                : (lang === 'id'
                  ? 'Sesi ini belum memiliki soal yang diselesaikan dan akan dihapus.'
                  : 'This session has no completed questions and will be discarded.')}
            </p>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirmEnd(false)}>
                {lang === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button className="btn btn-danger" onClick={handleEndSession}>
                {lang === 'id' ? 'Akhiri' : 'End Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
