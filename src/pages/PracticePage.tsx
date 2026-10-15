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

  const lang = settings.instructionLanguage;
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

  // Explanations are only shown for wrong answers: always once the answer is
  // revealed (and always in an exam); otherwise they count as hints and
  // follow the hints setting.
  const showExplanations =
    !!lastEvaluation && (isExam || settings.hintsEnabled || showAnswer);
  // The exam (and multiple choice) shows the answer right away after a wrong answer
  const answerVisible = !!lastEvaluation && (showAnswer || isExam || isChoice);

  const getSpeechStateLabel = () => {
    const labels: Record<string, { en: string; id: string }> = {
      idle: { en: 'Tap to speak', id: 'Ketuk untuk berbicara' },
      listening: isKanji
        ? { en: 'Listening... tap ■ to cancel', id: 'Mendengarkan... ketuk ■ untuk batal' }
        : {
            en: `Listening... submits ${SILENCE_SUBMIT_MS / 1000}s after you stop talking · tap ■ to cancel`,
            id: `Mendengarkan... terkirim ${SILENCE_SUBMIT_MS / 1000} detik setelah berhenti bicara · ketuk ■ untuk batal`,
          },
      processing: { en: 'Processing...', id: 'Memproses...' },
      evaluating: { en: 'Evaluating...', id: 'Mengevaluasi...' },
      correct: { en: 'Correct!', id: 'Benar!' },
      retry: isExam ? { en: 'Answered', id: 'Sudah dijawab' } : { en: 'Try again', id: 'Coba lagi' },
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
            {getSessionModeLabel(session, lang)}
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
            {isKanji ? (
              <>
                <p className="question-context" style={{ marginBottom: 'var(--space-sm)' }}>
                  {lang === 'id'
                    ? 'Bagaimana cara membaca kata ini? Tulis dalam hiragana atau ucapkan.'
                    : 'How is this word read? Type it in hiragana or say it.'}
                </p>
                <p className="kanji-display">{currentQuestion.prompt}</p>
              </>
            ) : isChoice ? (
              <>
                {currentQuestion.passage && (
                  <div className="reading-passage">{currentQuestion.passage}</div>
                )}
                <p className="question-context" style={{ marginBottom: 'var(--space-sm)' }}>
                  {lang === 'id' ? 'Baca teks di atas, lalu pilih jawaban yang paling tepat.' : 'Read the text above, then choose the best answer.'}
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
                {lang === 'id' ? `Percobaan ${currentAttempts.length}/${maxAttempts}` : `Attempt ${currentAttempts.length}/${maxAttempts}`}
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
                  <Send size={16} /> {lang === 'id' ? 'Kirim Jawaban' : 'Submit'}
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
                    ? (lang === 'id' ? 'Mendengarkan...' : 'Listening...')
                    : isKanji
                      ? (lang === 'id' ? 'Ketik cara baca dalam hiragana, atau tekan mikrofon...' : 'Type the reading in hiragana, or tap the mic...')
                      : (lang === 'id' ? 'Ketik jawaban dalam bahasa Jepang, atau tekan mikrofon...' : 'Type your answer in Japanese, or tap the mic...')}
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
                  title={lang === 'id' ? 'Kirim' : 'Submit'}
                >
                  <Send size={16} />
                </button>
              </div>
            ) : (
              <div className="transcript-display">
                {editedTranscript || finalTranscript || (lang === 'id' ? '(tidak ada jawaban)' : '(no answer)')}
              </div>
            )}

            {/* Kanji: give up and see the answer without guessing */}
            {isKanji && !lastEvaluation && speechState !== 'evaluating' && speechState !== 'processing' && (
              <button className="btn btn-ghost btn-sm" onClick={handleRevealAnswer}>
                <Eye size={14} /> {lang === 'id' ? 'Lihat Jawaban' : 'Show Answer'}
              </button>
            )}

            {/* Mic Controls */}
            <div className="game-controls">
              {speechSupported ? (
                <button
                  className={`mic-button ${speechState === 'listening' ? 'listening' : ''} ${speechState === 'correct' ? 'correct' : ''}`}
                  onClick={speechState === 'listening' ? stopListening : startListening}
                  title={speechState === 'listening'
                    ? (lang === 'id' ? 'Batalkan rekaman' : 'Cancel recording')
                    : (lang === 'id' ? 'Bicara' : 'Speak')}
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
                ? (lang === 'id' ? 'Benar! 🎉 Selesai!' : 'Correct! 🎉 All done!')
                : (lang === 'id' ? 'Benar! 🎉 Lanjut ke soal berikutnya...' : 'Correct! 🎉 Next question...')}
            </div>
          )}

          {/* Wrong answer feedback */}
          {lastEvaluation && !lastEvaluation.correct && (
            <div style={{ width: '100%', maxWidth: 600 }} className="animate-in">
              <div className="feedback-panel feedback-incorrect">
                <div className="feedback-title">
                  <RotateCcw size={20} /> {currentAttempts.length === 0
                    ? (lang === 'id' ? 'Jawaban ditampilkan' : 'Answer revealed')
                    : isExam || isChoice
                      ? (lang === 'id' ? 'Salah' : 'Incorrect')
                      : (lang === 'id' ? 'Belum tepat' : 'Not quite right')}
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
                      ? (lang === 'id' ? 'Cara baca' : 'Reading')
                      : (lang === 'id' ? 'Jawaban yang diharapkan' : 'Expected answer')}
                  </div>
                  <div className="answer-reveal-text">
                    {isKanji ? `${currentQuestion.prompt}（${currentQuestion.expectedAnswer}）` : currentQuestion.expectedAnswer}
                  </div>
                  {isKanji && (
                    <>
                      {currentQuestion.alternativeAnswers && currentQuestion.alternativeAnswers.length > 0 && (
                        <div className="answer-reveal-extra">
                          {lang === 'id' ? 'Bacaan lain: ' : 'Also read: '}
                          <span className="jp-text">{currentQuestion.alternativeAnswers.join('、')}</span>
                        </div>
                      )}
                      <div className="answer-reveal-extra">
                        {lang === 'id' ? 'Arti: ' : 'Meaning: '}{currentQuestion.intendedMeaning}
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
                    <RotateCcw size={16} /> {lang === 'id' ? 'Coba Lagi' : 'Try Again'}
                  </button>
                ) : (
                  <button className="btn btn-primary btn-lg" onClick={goToNextQuestion}>
                    <SkipForward size={16} />
                    {questionNum >= session.questionCount
                      ? (lang === 'id' ? 'Selesai!' : 'Finish!')
                      : (lang === 'id' ? 'Soal Berikutnya' : 'Next Question')}
                  </button>
                )}
                {!answerVisible && (
                  // In kanji mode showing the answer means giving up on the question
                  <button className="btn btn-ghost" onClick={isKanji ? handleRevealAnswer : () => setShowAnswer(true)}>
                    <Eye size={16} /> {lang === 'id' ? 'Lihat Jawaban' : 'Show Answer'}
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
