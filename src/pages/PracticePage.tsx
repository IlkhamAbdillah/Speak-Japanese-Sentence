import { useEffect, useCallback, useState, useRef } from 'react';
import {
  Mic,
  MicOff,
  Square,
  SkipForward,
  RotateCcw,
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
import type { PresetQuestions } from '../hooks/useSession';
import { usePushToTalk } from '../hooks/usePushToTalk';
import { getSessionModeLabel, isSingleAttemptMode, isKanjiMode, isMultipleChoiceMode, isStoryMode } from '../types';
import MultipleChoice from '../components/MultipleChoice';
import { isSpeechRecognitionSupported, prefersPushToTalk, SILENCE_SUBMIT_MS } from '../services/speech';
import { loadActiveSession } from '../services/storage';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n';

interface PracticePageProps {
  settings: UserSettings;
  onFinish: (sessionId: string) => void;
  onExit: () => void;
  /** Continue the session saved before a page reload instead of starting a new one */
  resume?: boolean;
  /** Practise these questions again instead of generating new ones */
  preset?: PresetQuestions;
}

/** How long "Correct!" stays on screen before the next question appears. */
const CORRECT_ADVANCE_MS = 1200;

export default function PracticePage({ settings, onFinish, onExit, resume, preset }: PracticePageProps) {
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
    restoreSession,
    startListening,
    stopListening,
    releaseListening,
    micStopped,
    submitTranscript,
    submitChoice,
    nextQuestion,
    retryQuestion,
    revealAnswer,
    answerShown,
    endSession,
    hintsUsed,
    openHint,
  } = useSession();

  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  // Phones: hold the mic to talk, release to submit, slide away and release to cancel
  const pushToTalk = prefersPushToTalk();
  const micDisabled =
    speechState === 'evaluating' ||
    speechState === 'processing' ||
    !!lastEvaluation;
  const ptt = usePushToTalk({
    onStart: startListening,
    onRelease: releaseListening,
    onCancel: stopListening,
    // Also while still listening after a release (waiting for the phone's last words)
    disabled: micDisabled || speechState === 'listening',
  });

  const { lang, t } = useI18n();
  const isSingleAttempt = isSingleAttemptMode(settings);
  const isKanji = isKanjiMode(settings);
  const isChoice = isMultipleChoiceMode(settings);
  const maxAttempts = getMaxAttempts(settings);

  // Clear per-question UI state whenever we move on
  const goToNextQuestion = useCallback(() => {
    setEditedTranscript('');
    setSelectedChoice(null);
    nextQuestion();
  }, [nextQuestion]);


  // Start session on mount. React StrictMode runs mount effects twice in dev; without
  // this guard two question sets were generated and the slower one reset the session.
  const sessionStartedRef = useRef(false);
  useEffect(() => {
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    const saved = resume ? loadActiveSession(settings) : null;
    if (saved) restoreSession(settings, saved);
    else startSession(settings, preset);
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
            {t(isStoryMode(settings) ? 'story.generatingTitle' : 'practice.generatingTitle')}
          </p>
          <p className="empty-state-text">
            {t(isStoryMode(settings) ? 'story.generatingText' : 'practice.generatingText')}
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
  const isLast = questionNum >= session.questionCount;

  // Story translation: where this sentence is, and the sentences before it in its paragraph
  const story = session.story;
  const inStory = !!story && currentQuestion.paragraphIndex !== undefined && currentQuestion.sentenceIndex !== undefined;
  const storyParagraph = inStory ? story.paragraphs[currentQuestion.paragraphIndex!] ?? [] : [];
  const storyBefore = inStory ? storyParagraph.slice(0, currentQuestion.sentenceIndex) : [];

  // Hints before answering, opened one step at a time: vocabulary, then grammar.
  // Show Answer stays the last step.
  const hintSteps = [
    { label: t('practice.hintVocabulary'), items: currentQuestion.relevantVocabulary },
    { label: t('practice.hintGrammar'), items: currentQuestion.relevantGrammar },
  ].filter((step) => step.items.length > 0);
  const hintsAllowed = settings.hintsEnabled && !isSingleAttempt && !isKanji && !isChoice;
  const openedHints = hintsAllowed ? hintSteps.slice(0, hintsUsed) : [];

  const speechSupported = isSpeechRecognitionSupported();
  const micHandlers = pushToTalk
    ? ptt.handlers
    : { onClick: speechState === 'listening' ? stopListening : startListening };

  // Explanations are only shown for wrong answers: always once the answer is
  // revealed (and always with a single attempt); otherwise they count as hints and
  // follow the hints setting.
  const showExplanations =
    !!lastEvaluation && (isSingleAttempt || settings.hintsEnabled || answerShown);
  // A single attempt (and multiple choice) shows the answer right away after a wrong answer
  const answerVisible = !!lastEvaluation && (answerShown || isSingleAttempt || isChoice);

  const getSpeechStateLabel = () => {
    const labels: Record<string, MessageKey> = {
      idle: pushToTalk ? 'practice.speech.idleHold' : 'practice.speech.idle',
      listening: pushToTalk
        ? ptt.cancelArmed
          ? 'common.releaseToCancel'
          : micStopped ? 'practice.speech.micStoppedHold' : 'practice.speech.listeningHold'
        : isKanji ? 'practice.speech.listeningKanji' : 'practice.speech.listening',
      processing: 'practice.speech.processing',
      evaluating: 'practice.speech.evaluating',
      correct: 'practice.speech.correct',
      retry: isSingleAttempt ? 'practice.speech.answered' : 'practice.speech.retry',
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
            {t(story ? 'story.sentenceOf' : 'practice.questionOf', { current: questionNum, total: session.questionCount })}
          </span>
        </div>
        <div className="session-controls">
          <span className="timer">{formatTime(elapsedMs)}</span>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setShowConfirmEnd(true)}
            title={t('practice.endSession')}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Fewer questions than asked for (kanji: not enough kanji, or AI items rejected) */}
      {session.requestedCount && session.currentQuestionIndex === 0 && !lastEvaluation && (
        <div className="alert alert-warning" style={{ marginBottom: 'var(--space-md)' }}>
          <AlertCircle size={16} />
          <span>{t('practice.fewerQuestions', { count: session.questionCount, requested: session.requestedCount })}</span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="progress-bar" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="progress-bar-fill" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="game-area animate-in">
        {/* Question Card */}
        <div className="question-card">
          {isKanji ? (
            <>
              <p className="question-context" style={{ marginBottom: 'var(--space-sm)' }}>
                {t('practice.kanjiInstruction')}
              </p>
              <p className="kanji-display">{currentQuestion.prompt}</p>
              {speechSupported && <p className="kanji-voice-tip">{t('practice.kanjiVoiceTip')}</p>}
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
              {inStory && (
                <>
                  <div className="story-meta">
                    {story.title && <span className="story-title">{story.title}</span>}
                    <span>
                      {t('story.position', {
                        paragraph: currentQuestion.paragraphIndex! + 1,
                        sentence: currentQuestion.sentenceIndex! + 1,
                      })}
                    </span>
                  </div>
                  {storyBefore.length > 0 && (
                    <p className="story-context">{storyBefore.map((s) => s.source).join(' ')}</p>
                  )}
                </>
              )}
              <p className="question-prompt">{currentQuestion.prompt}</p>
              {currentQuestion.context && (
                <p className="question-context">{currentQuestion.context}</p>
              )}
              {openedHints.map((step) => (
                <div key={step.label} className="hint-box story-hint">
                  <Lightbulb size={14} style={{ display: 'inline', marginRight: 4 }} />
                  <strong>{step.label}:</strong> <span className="story-hint-items">{step.items.join('、')}</span>
                </div>
              ))}
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

          {/* Mic Controls */}
          <div className="game-controls">
            {speechSupported ? (
              <button
                className={`mic-button ${pushToTalk ? 'push-to-talk' : ''} ${speechState === 'listening' ? 'listening' : ''} ${ptt.cancelArmed ? 'cancel-armed' : ''} ${speechState === 'correct' ? 'correct' : ''}`}
                style={pushToTalk ? ptt.buttonStyle : undefined}
                {...micHandlers}
                title={pushToTalk
                  ? t('common.holdToTalk')
                  : speechState === 'listening'
                    ? t('common.cancelRecording')
                    : t('common.speak')}
                disabled={micDisabled}
              >
                {ptt.cancelArmed ? (
                  <X size={28} />
                ) : speechState === 'listening' ? (
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
            {/* See the answer without answering. Kanji: that gives up the question.
                Practice: Try Again or Next (counted wrong) follow. */}
            {!isChoice && !lastEvaluation && speechState !== 'processing' && speechState !== 'listening' && speechState !== 'evaluating' && (
              <div className="answer-help-actions">
                {hintsAllowed && hintsUsed < hintSteps.length && (
                  <button className="btn btn-ghost btn-sm" onClick={openHint}>
                    <Lightbulb size={14} /> {t('practice.hint')}
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={revealAnswer}>
                  <Eye size={14} /> {t('practice.showAnswer')}
                </button>
              </div>
            )}
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
            {isLast
              ? t('practice.correctDone')
              : t(story ? 'practice.correctNextSentence' : 'practice.correctNext')}
          </div>
        )}

        {/* Wrong answer feedback */}
        {lastEvaluation && !lastEvaluation.correct && (
          <div style={{ width: '100%', maxWidth: 600 }} className="animate-in">
            <div className="feedback-panel feedback-incorrect">
              <div className="feedback-title">
                <RotateCcw size={20} /> {currentAttempts.length === 0
                  ? t('practice.answerRevealed')
                  : lastEvaluation.verdict
                    ? t(`practice.verdict.${lastEvaluation.verdict}`)
                  : isSingleAttempt || isChoice
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
                {/* Shown with the answer only: before that they would give it away */}
                {lastEvaluation.correctedAnswer && (
                  <div className="answer-reveal-extra">
                    <div className="answer-reveal-label">{t('practice.correctedAnswer')}</div>
                    <div className="jp-text jp-text-sm">{lastEvaluation.correctedAnswer}</div>
                  </div>
                )}
                {lastEvaluation.alternatives && lastEvaluation.alternatives.length > 0 && (
                  <div className="answer-reveal-extra">
                    <div className="answer-reveal-label">{t('practice.alternatives')}</div>
                    {lastEvaluation.alternatives.map((a, i) => (
                      <div key={i} className="jp-text jp-text-sm">{a}</div>
                    ))}
                  </div>
                )}
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
              {lastEvaluation.nextAction === 'retry' && (
                <button className="btn btn-primary btn-lg" onClick={() => {
                  retryQuestion();
                  setEditedTranscript('');
                }}>
                  <RotateCcw size={16} /> {t('practice.tryAgain')}
                </button>
              )}
              {/* Once the answer is shown, moving on is allowed even with attempts left */}
              {(lastEvaluation.nextAction !== 'retry' || answerVisible) && (
                <button
                  className={`btn btn-lg ${lastEvaluation.nextAction === 'retry' ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={goToNextQuestion}
                >
                  <SkipForward size={16} />
                  {isLast
                    ? t('practice.finish')
                    : t(story ? 'practice.nextSentence' : 'practice.nextQuestion')}
                </button>
              )}
              {!answerVisible && (
                // In kanji mode showing the answer means giving up on the question
                <button className="btn btn-ghost" onClick={revealAnswer}>
                  <Eye size={16} /> {t('practice.showAnswer')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

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
