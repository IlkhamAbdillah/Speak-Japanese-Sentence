import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, Check, Eye, Lightbulb, Mic, MicOff, RotateCcw, Send, SkipForward, Square, Trophy, Volume2, X } from 'lucide-react';
import type { GrammarPoint } from '../services/grammar';
import { patternLabel } from '../services/grammar';
import type { GrammarEvaluation, GrammarPracticeQuestion } from '../services/grammarPractice';
import { isExpectedAnswer } from '../services/grammarPractice';
import {
  finishRecognition,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  prefersPushToTalk,
  SILENCE_SUBMIT_MS,
  speakJapanese,
  startRecognition,
  stopRecognition,
} from '../services/speech';
import { usePushToTalk } from '../hooks/usePushToTalk';
import { useEscapeKey } from '../hooks/useEscapeKey';
import ConfirmDialog from './ConfirmDialog';
import { GrammarSentence } from './GrammarRow';
import { useI18n } from '../i18n';

interface GrammarPracticeProps {
  point: GrammarPoint;
  questions: GrammarPracticeQuestion[];
  /** Grades a said / typed answer (the AI) */
  evaluate: (q: GrammarPracticeQuestion, answer: string, spoken: boolean, previous: string[]) => Promise<GrammarEvaluation>;
  /** Practise these questions again (Retry wrong; doesn't count for the progress) */
  onRetry: (wrong: GrammarPracticeQuestion[]) => void;
  /** Back to the grammar point's card */
  onExit: () => void;
  /** Once, when the last question is answered: right on the first try without Show answer, per question */
  onFinish: (outcomes: boolean[]) => void;
  /** Shown on the results card: what the practice did to the point's progress */
  resultNote?: ReactNode;
  /** The next point's practice from the results card (also Enter) */
  onNext?: () => void;
  nextLabel?: string;
}

/** How long "Correct!" stays on screen before the next question, as in practice. */
const CORRECT_ADVANCE_MS = 1200;

// answering → checking (AI) → correct (auto-advance) | wrong (Try again / Show answer) | revealed
type Phase = 'answering' | 'checking' | 'correct' | 'wrong' | 'revealed';

/** A sentence with its grammar part highlighted and a listen button. */
function AnswerSentence({ q }: { q: GrammarPracticeQuestion }) {
  const { t } = useI18n();
  return (
    <div className="grammar-practice-answer">
      <span className="jp-text" lang="ja"><GrammarSentence example={q.example} /></span>
      {isSpeechSynthesisSupported() && (
        <button
          className="btn btn-ghost btn-icon grammar-listen"
          onClick={() => speakJapanese(q.example.text)}
          title={t('words.listen')}
          aria-label={t('words.listen')}
        >
          <Volume2 size={16} />
        </button>
      )}
    </div>
  );
}

/**
 * The practice of one grammar point (kanji-quiz layout): a sentence in the learner's
 * language to say or type in Japanese with the point, graded by the AI. A wrong
 * answer can be tried again (R) or the answer shown (Enter), like the kanji reading
 * practice.
 */
export default function GrammarPractice({ point, questions, evaluate, onRetry, onExit, onFinish, resultNote, onNext, nextLabel }: GrammarPracticeProps) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('answering');
  const [outcomes, setOutcomes] = useState<boolean[]>([]);
  const [typed, setTyped] = useState('');
  const [lastAnswer, setLastAnswer] = useState('');
  // Wrong answers to the current question so far (sent to the AI for a better hint)
  const [previous, setPrevious] = useState<string[]>([]);
  const [evaluation, setEvaluation] = useState<GrammarEvaluation | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [showWords, setShowWords] = useState(false);

  const [listening, setListening] = useState(false);
  const [micStopped, setMicStopped] = useState(false);
  const [interim, setInterim] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  // An AI grade that comes back after the question changed is dropped
  const checkId = useRef(0);

  const finished = index >= questions.length;
  const question = questions[index] as GrammarPracticeQuestion | undefined;

  const record = (correct: boolean) => {
    setOutcomes((prev) => {
      if (prev[index] !== undefined) return prev;
      const next = [...prev];
      next[index] = correct;
      return next;
    });
  };

  const goNext = () => {
    stopRecognition();
    checkId.current++;
    setListening(false);
    setMicStopped(false);
    setInterim('');
    setMicError(null);
    setTyped('');
    setLastAnswer('');
    setPrevious([]);
    setEvaluation(null);
    setCheckError(null);
    setShowWords(false);
    setPhase('answering');
    setIndex((i) => i + 1);
  };

  const submitAnswer = async (text: string, spoken = false) => {
    const answer = text.trim();
    if (phase !== 'answering' || !question || !answer) return;
    setLastAnswer(answer);
    setCheckError(null);
    if (isExpectedAnswer(question, answer)) {
      record(true);
      setPhase('correct');
      return;
    }
    const id = ++checkId.current;
    setPhase('checking');
    try {
      const result = await evaluate(question, answer, spoken, previous);
      if (id !== checkId.current) return;
      setEvaluation(result);
      record(result.correct);
      if (!result.correct) setPrevious((p) => [...p, answer]);
      setPhase(result.correct ? 'correct' : 'wrong');
    } catch (err) {
      if (id !== checkId.current) return;
      // Not graded: back to answering with the text kept, so it can be sent again
      setCheckError(err instanceof Error ? err.message : String(err));
      setTyped(answer);
      setPhase('answering');
    }
  };

  const reveal = () => {
    stopRecognition();
    checkId.current++;
    setListening(false);
    record(false);
    setPhase('revealed');
  };

  const tryAgain = () => {
    setTyped('');
    setPhase('answering');
  };

  const submitRef = useRef(submitAnswer);
  const goNextRef = useRef(goNext);
  const tryAgainRef = useRef(tryAgain);
  const revealRef = useRef(reveal);
  useEffect(() => {
    submitRef.current = submitAnswer;
    goNextRef.current = goNext;
    tryAgainRef.current = tryAgain;
    revealRef.current = reveal;
  });

  // ─── Voice ────────────────────────────────────────────
  const pushToTalk = prefersPushToTalk();
  const startListening = () => {
    setInterim('');
    setMicError(null);
    setMicStopped(false);
    setCheckError(null);
    const started = startRecognition({
      onInterimResult: setInterim,
      onFinalResult: (text) => {
        setListening(false);
        setMicStopped(false);
        setInterim('');
        setTyped(text);
        submitRef.current(text, true);
      },
      onError: (error) => {
        setListening(false);
        setMicError(error);
      },
      onStopped: () => setMicStopped(true),
      onEnd: () => {
        setListening(false);
        setMicStopped(false);
      },
    }, pushToTalk
      // Phone: hold to talk, the answer is submitted on release
      ? { untilStopped: true, restartOnEnd: false }
      // A sentence: submitted after a few seconds of silence, like the speaking practice
      : {});
    setListening(started);
    if (!started) setMicError('Failed to start speech recognition.');
  };
  const cancelListening = () => {
    stopRecognition();
    setListening(false);
    setMicStopped(false);
    setInterim('');
  };
  const releaseListening = () => {
    finishRecognition();
    setMicStopped(false);
  };
  const micDisabled = phase !== 'answering';
  const ptt = usePushToTalk({
    onStart: startListening,
    onRelease: releaseListening,
    onCancel: cancelListening,
    disabled: micDisabled || listening,
  });

  // Leaving the practice stops the mic and drops a pending grade
  useEffect(() => () => {
    stopRecognition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    checkId.current++;
  }, []);

  // Exit / Esc asks first (user-requested)
  const [confirmExit, setConfirmExit] = useState(false);
  const askExit = () => {
    cancelListening();
    setConfirmExit(true);
  };
  useEscapeKey(askExit, !finished && !confirmExit);

  // Results: Enter starts the next point's practice
  const onNextRef = useRef(onNext);
  useEffect(() => {
    onNextRef.current = onNext;
  });
  const hasNext = finished && !!onNext;
  useEffect(() => {
    if (!hasNext) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat || e.isComposing || e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      onNextRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasNext]);

  // Report the outcome once (the page saves the point's progress)
  const reported = useRef(false);
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  });
  useEffect(() => {
    if (!finished || reported.current) return;
    reported.current = true;
    onFinishRef.current(questions.map((_, i) => !!outcomes[i]));
  }, [finished, questions, outcomes]);

  // A correct answer gets no explanation: flash and move on
  useEffect(() => {
    if (phase !== 'correct') return;
    const timer = setTimeout(() => goNextRef.current(), CORRECT_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [phase, index]);

  // Keyboard: H shows the words; after a wrong answer R tries again, Enter shows the answer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (phase === 'answering') {
        if (e.key === 'h' || e.key === 'H') setShowWords(true);
        return;
      }
      if (phase === 'wrong') {
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          tryAgainRef.current();
        } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
          e.preventDefault();
          revealRef.current();
        }
        return;
      }
      if (e.key !== 'Enter' || e.target instanceof HTMLButtonElement) return;
      if (phase === 'revealed') goNextRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  // ─── Results ──────────────────────────────────────────
  if (finished || !question) {
    const correctCount = outcomes.filter(Boolean).length;
    const wrong = questions.filter((_, i) => !outcomes[i]);
    const percent = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
    return (
      <div className="vocab-quiz animate-in">
        <div className="question-card vocab-result">
          <Trophy size={36} style={{ color: 'var(--accent-primary)' }} />
          <h2 className="card-title">{t('words.resultTitle')}</h2>
          <p className="grammar-practice-pattern jp-text" lang="ja">{point.pattern}</p>
          <p className="vocab-score">{t('words.score', { correct: correctCount, total: questions.length })}</p>
          <p className="question-context">{wrong.length === 0 ? t('words.perfect') : `${percent}%`}</p>
          {resultNote && <p className="kanji-practice-note">{resultNote}</p>}
          <div className="start-card-actions">
            <button className="btn btn-secondary btn-lg" onClick={onExit}>
              {t('grammar.practice.back')}
            </button>
            {wrong.length > 0 && (
              <button className={`btn ${onNext ? 'btn-secondary' : 'btn-primary'} btn-lg`} onClick={() => onRetry(wrong)}>
                <RotateCcw size={18} /> {t('words.retryWrong', { count: wrong.length })}
              </button>
            )}
            {onNext && (
              <button className="btn btn-primary btn-lg" onClick={onNext}>
                {nextLabel} <SkipForward size={18} />
              </button>
            )}
          </div>
          {onNext && !pushToTalk && <p className="vocab-tip">{t('grammar.practice.nextTip')}</p>}
        </div>
        {wrong.length > 0 && (
          <section className="vocab-review">
            <h3 className="card-title">{t('grammar.practice.review')}</h3>
            <div className="vocab-list">
              {wrong.map((q) => (
                <div key={q.id} className="vocab-row grammar-practice-review-row">
                  <AnswerSentence q={q} />
                  <span className="grammar-practice-review-translation">
                    {q.prompt}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ─── Question ─────────────────────────────────────────
  const answered = phase !== 'answering' && phase !== 'checking';
  const isLast = index === questions.length - 1;

  const micHandlers = pushToTalk
    ? ptt.handlers
    : { onClick: listening ? cancelListening : startListening };
  const micLabel = phase === 'checking'
    ? t('practice.speech.evaluating')
    : pushToTalk
      ? ptt.cancelArmed
        ? t('common.releaseToCancel')
        : listening
          ? t(micStopped ? 'practice.speech.micStoppedHold' : 'practice.speech.listeningHold')
          : t('practice.speech.idleHold')
      : listening
        ? t('practice.speech.listening', { seconds: SILENCE_SUBMIT_MS / 1000 })
        : t('practice.speech.idle');

  const nextButton = (
    <button className="btn btn-primary btn-lg" onClick={goNext} autoFocus>
      {isLast ? t('words.seeResults') : t('words.next')} <SkipForward size={16} />
    </button>
  );

  const sheet = phase === 'correct' ? (
    <div className="kanji-sheet kanji-sheet-correct animate-in">
      <Check size={20} /> {t('words.correct')}
    </div>
  ) : phase === 'wrong' ? (
    // A wrong sentence can be tried again (with the AI's nudge) before the answer is shown
    <div className="kanji-sheet kanji-sheet-wrong animate-in">
      <div className="kanji-sheet-main">
        <div className="kanji-sheet-title">
          <RotateCcw size={18} /> {t('words.wrong')}
        </div>
        {evaluation?.feedback && <p className="grammar-practice-feedback">{evaluation.feedback}</p>}
        {evaluation?.hint && <p className="grammar-practice-hint"><Lightbulb size={14} /> {evaluation.hint}</p>}
        {!pushToTalk && (
          <div className="vocab-tip kanji-practice-keys">
            <p>{t('kanjiList.practice.tryAgainKey')}</p>
            <p>{t('kanjiList.practice.showAnswerKey')}</p>
          </div>
        )}
      </div>
      <div className="kanji-sheet-actions">
        <button className="btn btn-secondary" onClick={reveal}>
          <Eye size={16} /> {t('words.showAnswer')}
        </button>
        <button className="btn btn-primary" onClick={tryAgain}>
          <RotateCcw size={16} /> {t('words.tryAgain')}
        </button>
      </div>
    </div>
  ) : phase === 'revealed' ? (
    <div className="kanji-sheet kanji-sheet-answer animate-in">
      <div className="kanji-sheet-main">
        <div className="vocab-answer-label">{t('words.revealed')}</div>
        <AnswerSentence q={question} />
        {evaluation?.corrected && previous.length > 0 && (
          <p className="grammar-practice-corrected">
            <span>{t('practice.correctedAnswer')}:</span> <span className="jp-text" lang="ja">{evaluation.corrected}</span>
          </p>
        )}
        {(evaluation?.explanation || question.explanation) && (
          <p className="grammar-practice-explanation">
            {evaluation?.explanation && previous.length > 0 ? `${evaluation.explanation} ` : ''}
            {question.explanation}
          </p>
        )}
      </div>
      <div className="kanji-sheet-actions">{nextButton}</div>
    </div>
  ) : null;

  return (
    <div className="vocab-quiz kanji-quiz grammar-practice kanji-quiz-say">
      <div className="kanji-quiz-top">
        <div className="session-header">
          <div className="session-info">
            <span className="kanji-quiz-count">
              {t('words.questionOf', { current: index + 1, total: questions.length })}
            </span>
            <span className="badge badge-success">
              <Check size={12} /> {outcomes.filter(Boolean).length}
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={askExit}>
            <X size={16} /> {t('kanjiList.practice.exit')}
          </button>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
      </div>
      {confirmExit && (
        <ConfirmDialog
          title={t('kanjiList.practice.exitTitle')}
          text={t('grammar.practice.exitText')}
          confirmLabel={t('kanjiList.practice.exit')}
          onCancel={() => setConfirmExit(false)}
          onConfirm={onExit}
        />
      )}

      <div className="kanji-quiz-stage animate-in" key={index}>
        <div className="question-card grammar-quiz-card">
          <p className="question-context">
            {t('grammar.practice.instructionSay', { pattern: patternLabel(point) })}
          </p>
              <p className="question-prompt grammar-practice-prompt">{question.prompt}</p>
              {/* Key words: a hint that doesn't change the score (the grammar is what's practised) */}
              {question.words.length > 0 && (showWords || answered ? (
                <ul className="grammar-practice-words jp-text" lang="ja">
                  {question.words.map((w) => <li key={w}>{w}</li>)}
                </ul>
              ) : (
                <button className="btn btn-ghost btn-sm kanji-meaning-hint" onClick={() => setShowWords(true)} title="H">
                  <Lightbulb size={14} /> {t('grammar.practice.words')}
                </button>
              ))}
        </div>

          <div className="kanji-say">
            {phase === 'answering' ? (
              <div className="answer-input-row">
                <input
                  className={`form-input answer-input ${listening ? 'listening' : ''}`}
                  autoFocus
                  placeholder={listening ? t('common.listening') : t('grammar.practice.answerPlaceholder')}
                  value={listening ? interim : typed}
                  readOnly={listening}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => {
                    // Don't submit while an IME (kana → kanji) conversion is in progress
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitAnswer(typed);
                  }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => submitAnswer(typed)}
                  disabled={!typed.trim() || listening}
                  title={t('practice.submit')}
                >
                  <Send size={16} />
                </button>
              </div>
            ) : (
              <div className={`transcript-display jp-text ${phase === 'correct' ? 'is-correct' : ''}`} lang="ja">
                {lastAnswer || t('common.noAnswer')}
              </div>
            )}
            {phase !== 'revealed' && <div className="game-controls">
              {isSpeechRecognitionSupported() ? (
                <button
                  className={`mic-button ${pushToTalk ? 'push-to-talk' : ''} ${listening ? 'listening' : ''} ${ptt.cancelArmed ? 'cancel-armed' : ''} ${phase === 'correct' ? 'correct' : ''}`}
                  style={pushToTalk ? ptt.buttonStyle : undefined}
                  {...micHandlers}
                  title={pushToTalk ? t('common.holdToTalk') : listening ? t('common.cancelRecording') : t('common.speak')}
                  disabled={micDisabled}
                >
                  {phase === 'checking' ? <span className="spinner" />
                    : ptt.cancelArmed ? <X size={28} />
                      : listening ? <Square size={28} />
                        : phase === 'correct' ? <Check size={28} /> : <Mic size={28} />}
                </button>
              ) : (
                <button className="mic-button" disabled>
                  <MicOff size={28} />
                </button>
              )}
              {(phase === 'answering' || phase === 'checking') && <span className="speech-state-label">{micLabel}</span>}
              {phase === 'answering' && !listening && (
                <div className="answer-help-actions">
                  <button className="btn btn-ghost btn-sm" onClick={reveal}>
                    <Eye size={14} /> {t('words.showAnswer')}
                  </button>
                </div>
              )}
            </div>}
            {(micError || checkError) && (
              <div className="alert alert-error kanji-say-error">
                <AlertCircle size={16} /> <span>{checkError ?? micError}</span>
              </div>
            )}
          </div>
      </div>

      <div className="kanji-sheet-slot">{sheet}</div>
    </div>
  );
}
