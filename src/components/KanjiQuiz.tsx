import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Eye, Mic, MicOff, RotateCcw, Send, Square, X, SkipForward, Trophy } from 'lucide-react';
import type { KanjiEntry } from '../services/kanjiList';
import { plainReading, splitKun, toKatakana } from '../services/kanjiList';
import type { KanjiPracticeQuestion } from '../services/kanjiPractice';
import { isPracticeAnswerCorrect } from '../services/kanjiPractice';
import type { KanjiQuestion } from '../services/kanjiQuiz';
import { isKanjiReadingCorrect, quizMeaning, quizReading } from '../services/kanjiQuiz';
import { isIncompleteKanjiAnswer } from '../services/ai';
import {
  finishRecognition,
  isSpeechRecognitionSupported,
  prefersPushToTalk,
  startRecognition,
  stopRecognition,
} from '../services/speech';
import { usePushToTalk } from '../hooks/usePushToTalk';
import MultipleChoice from './MultipleChoice';
import { useI18n } from '../i18n';

interface KanjiQuizProps {
  questions: KanjiQuestion[];
  /** Start another quiz with these questions (Retry wrong) */
  onRetry: (wrong: KanjiQuestion[]) => void;
  /** Back to the quiz options (practice: to the kanji's card) */
  onExit: () => void;
  /** Once, when the last question is answered: right on the first try without Show answer, per question */
  onFinish?: (outcomes: boolean[]) => void;
  /** Shown on the results card (practice: what it did to the kanji's progress) */
  resultNote?: ReactNode;
  /** The results card's exit button, when it isn't "New quiz" */
  exitLabel?: string;
}

/** All readings of a kanji in one line: on'yomi in katakana, then kun'yomi. */
const allReadings = (e: KanjiEntry) =>
  [...e.on.map(toKatakana), ...e.kun.slice(0, 6).map(plainReading)].join('、');

/** A kanji of the results list: the kanji, its main readings and meanings. */
function KanjiResultRow({ entry }: { entry: KanjiEntry }) {
  return (
    <div className="vocab-row">
      <div className="vocab-row-word">
        <span className="vocab-word jp-text" lang="ja">{entry.kanji}</span>
        <span className="vocab-reading jp-text" lang="ja">{quizReading(entry)}</span>
      </div>
      <div className="vocab-row-meaning">
        <span>{entry.meanings.join(', ')}</span>
      </div>
    </div>
  );
}

/** A reading practice word with the kanji's part of the reading highlighted: 食[しょく]じ. */
function PracticeReading({ q }: { q: KanjiPracticeQuestion }) {
  return (
    <>
      {q.said.slice(0, q.start)}
      <mark>{q.said.slice(q.start, q.end)}</mark>
      {q.said.slice(q.end)}
    </>
  );
}

/** A practice word of the results list: the word, its reading and meaning. */
function PracticeResultRow({ q }: { q: KanjiPracticeQuestion }) {
  return (
    <div className="vocab-row">
      <div className="vocab-row-word">
        <span className="vocab-word jp-text" lang="ja">{q.word.written}</span>
        <span className="vocab-reading kanji-practice-reading jp-text" lang="ja"><PracticeReading q={q} /></span>
      </div>
      <div className="vocab-row-meaning">
        <span>{q.word.meaning}</span>
      </div>
    </div>
  );
}

/** The kanji's reading a practice word uses, as on the kanji card: ショク, た(べる). */
function readingLabel(q: KanjiPracticeQuestion): string {
  if (q.onyomi) return toKatakana(q.reading);
  const { stem, okurigana } = splitKun(q.reading);
  return okurigana ? `${stem}(${okurigana})` : stem;
}

/** How long "Correct!" stays on screen before the next question, as in practice. */
const CORRECT_ADVANCE_MS = 1200;

// answering → correct (auto-advance) | wrong (choice: final; say: Try again / Show answer) | revealed
type Phase = 'answering' | 'correct' | 'wrong' | 'revealed';

/**
 * The Kanji page's quiz (same flow as the Words quiz): multiple choice for meaning /
 * kanji / reading, or say or type any reading. Checked locally, not saved.
 */
export default function KanjiQuiz({ questions, onRetry, onExit, onFinish, resultNote, exitLabel }: KanjiQuizProps) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('answering');
  // Right on the first try without Show answer, per question
  const [outcomes, setOutcomes] = useState<boolean[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [lastAnswer, setLastAnswer] = useState('');

  const [listening, setListening] = useState(false);
  const [micStopped, setMicStopped] = useState(false);
  const [interim, setInterim] = useState('');
  const [micError, setMicError] = useState<string | null>(null);

  const finished = index >= questions.length;
  const question = questions[index] as KanjiQuestion | undefined;
  const entry = question?.entry;
  const correctChoice = question?.choices?.findIndex((c) => c.kanji === entry?.kanji) ?? -1;

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
    setListening(false);
    setMicStopped(false);
    setInterim('');
    setMicError(null);
    setChosen(null);
    setTyped('');
    setLastAnswer('');
    setPhase('answering');
    setIndex((i) => i + 1);
  };

  const choose = (i: number) => {
    if (phase !== 'answering' || !question?.choices) return;
    const correct = i === correctChoice;
    setChosen(i);
    record(correct);
    setPhase(correct ? 'correct' : 'wrong');
  };

  const submitAnswer = (text: string, spoken = false) => {
    if (phase !== 'answering' || !entry || !text.trim()) return;
    const correct = question?.practice
      ? isPracticeAnswerCorrect(question.practice, text, spoken)
      : isKanjiReadingCorrect(entry, text, spoken);
    setLastAnswer(text.trim());
    record(correct);
    setPhase(correct ? 'correct' : 'wrong');
  };

  const reveal = () => {
    stopRecognition();
    setListening(false);
    record(false);
    setPhase('revealed');
  };

  const tryAgain = () => {
    setTyped('');
    setPhase('answering');
  };

  // Speech recognition delivers its result later: read the latest submit through a ref
  const submitRef = useRef(submitAnswer);
  const goNextRef = useRef(goNext);
  const chooseRef = useRef(choose);
  const tryAgainRef = useRef(tryAgain);
  useEffect(() => {
    submitRef.current = submitAnswer;
    goNextRef.current = goNext;
    chooseRef.current = choose;
    tryAgainRef.current = tryAgain;
  });

  // ─── Voice (say questions) ────────────────────────────
  const pushToTalk = prefersPushToTalk();
  const startListening = () => {
    setInterim('');
    setMicError(null);
    setMicStopped(false);
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
      // One reading: submit as soon as it's recognised, unless only 「それは…」 was said so far
      : { waitForSilence: false, isIncomplete: isIncompleteKanjiAnswer });
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

  // Leaving the quiz stops the mic
  useEffect(() => () => stopRecognition(), []);

  // Report the outcome once (a reading practice saves the kanji's progress)
  const reported = useRef(false);
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  });
  useEffect(() => {
    if (!finished || reported.current) return;
    reported.current = true;
    onFinishRef.current?.(questions.map((_, i) => !!outcomes[i]));
  }, [finished, questions, outcomes]);

  // A correct answer gets no explanation: flash and move on
  useEffect(() => {
    if (phase !== 'correct') return;
    const timer = setTimeout(() => goNextRef.current(), CORRECT_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [phase, index]);

  // Keyboard: 1–4 picks a choice, Enter goes to the next question
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.isComposing) return;
      if (phase === 'answering' && question?.choices) {
        const n = Number(e.key);
        if (n >= 1 && n <= question.choices.length) chooseRef.current(n - 1);
        return;
      }
      // A focused button already handles Enter itself
      if (e.key !== 'Enter' || e.target instanceof HTMLButtonElement) return;
      if (phase === 'revealed' || (phase === 'wrong' && question?.choices)) goNextRef.current();
      else if (phase === 'wrong') tryAgainRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, question]);

  // ─── Results ──────────────────────────────────────────
  if (finished || !question || !entry) {
    const correctCount = outcomes.filter(Boolean).length;
    const wrong = questions.filter((_, i) => !outcomes[i]);
    const percent = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
    return (
      <div className="vocab-quiz animate-in">
        <div className="question-card vocab-result">
          <Trophy size={36} style={{ color: 'var(--accent-primary)' }} />
          <h2 className="card-title">{t('words.resultTitle')}</h2>
          <p className="vocab-score">{t('words.score', { correct: correctCount, total: questions.length })}</p>
          <p className="question-context">{wrong.length === 0 ? t('words.perfect') : `${percent}%`}</p>
          {resultNote && <p className="kanji-practice-note">{resultNote}</p>}
          <div className="start-card-actions">
            <button className="btn btn-secondary btn-lg" onClick={onExit}>
              {exitLabel ?? t('words.newQuiz')}
            </button>
            {wrong.length > 0 && (
              <button className="btn btn-primary btn-lg" onClick={() => onRetry(wrong)}>
                <RotateCcw size={18} /> {t('words.retryWrong', { count: wrong.length })}
              </button>
            )}
          </div>
        </div>
        {wrong.length > 0 && (
          <section className="vocab-review">
            <h3 className="card-title">{t(wrong[0].practice ? 'kanjiList.practice.wrongWords' : 'kanjiList.quiz.wrongKanji')}</h3>
            <div className="vocab-list">
              {wrong.map((q) => q.practice
                ? <PracticeResultRow key={q.practice.word.written} q={q.practice} />
                : <KanjiResultRow key={q.entry.kanji} entry={q.entry} />)}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ─── Question ─────────────────────────────────────────
  const isChoice = !!question.choices;
  const answered = phase !== 'answering';
  const isLast = index === questions.length - 1;
  const showAnswerCard = phase === 'revealed' || (phase === 'wrong' && isChoice);
  const choiceLabels = question.choices?.map((c) =>
    question.type === 'meaning' ? quizMeaning(c) : question.type === 'reading' ? quizReading(c) : c.kanji) ?? [];

  const micHandlers = pushToTalk
    ? ptt.handlers
    : { onClick: listening ? cancelListening : startListening };
  const micLabel = pushToTalk
    ? ptt.cancelArmed
      ? t('common.releaseToCancel')
      : listening
        ? t(micStopped ? 'practice.speech.micStoppedHold' : 'practice.speech.listeningHold')
        : t('practice.speech.idleHold')
    : listening
      ? t('practice.speech.listeningKanji')
      : t('practice.speech.idle');

  return (
    // kanji-quiz: compact sizes so a question fits on screen without scrolling (user-requested)
    <div className="vocab-quiz kanji-quiz">
      <div className="session-header">
        <div className="session-info">
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {t('words.questionOf', { current: index + 1, total: questions.length })}
          </span>
          <span className="badge badge-success">
            <Check size={12} /> {outcomes.filter(Boolean).length}
          </span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onExit}>
          <X size={16} /> {t('words.exit')}
        </button>
      </div>

      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>

      <div className="game-area animate-in" key={index}>
        <div className="question-card">
          <p className="question-context" style={{ marginBottom: 'var(--space-sm)' }}>
            {t(`kanjiList.quiz.instruction.${question.type}`)}
          </p>
          {question.practice ? (
            <>
              {/* The word with the kanji marked, the rest of its reading around a blank (食事 → ？じ), the meaning (not repeated on the answer card) */}
              <p className="vocab-prompt-word kanji-quiz-prompt kanji-practice-word jp-text" lang="ja">
                {[...question.practice.word.written].map((ch, i) =>
                  ch === entry.kanji ? <mark key={i}>{ch}</mark> : ch)}
              </p>
              <p className="kanji-practice-hint jp-text" lang="ja">
                {question.practice.said.slice(0, question.practice.start)}
                <span className="kanji-practice-blank">？</span>
                {question.practice.said.slice(question.practice.end)}
              </p>
              <p className="kanji-practice-meaning">{question.practice.word.meaning}</p>
            </>
          ) : question.type === 'kanji' ? (
            <p className="question-prompt">{quizMeaning(entry)}</p>
          ) : (
            <p className="vocab-prompt-word kanji-quiz-prompt jp-text" lang="ja">{entry.kanji}</p>
          )}
        </div>

        {isChoice ? (
          <>
            <div className={question.type === 'kanji' ? 'kanji-quiz-choices' : question.type === 'reading' ? 'jp-text' : undefined}>
            <MultipleChoice
              choices={choiceLabels}
              selected={chosen}
              onSelect={choose}
              result={answered && chosen !== null ? { chosen, correct: correctChoice } : null}
            />
            </div>
            {!answered && <p className="vocab-tip">{t('words.keyboardTip')}</p>}
          </>
        ) : (
          <>
            {phase === 'answering' ? (
              <div className="answer-input-row">
                <input
                  className={`form-input answer-input ${listening ? 'listening' : ''}`}
                  autoFocus
                  placeholder={listening ? t('common.listening') : t('kanjiList.quiz.answerPlaceholder')}
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
              <div className="transcript-display jp-text">{lastAnswer || t('common.noAnswer')}</div>
            )}

            <div className="game-controls">
              {isSpeechRecognitionSupported() ? (
                <button
                  className={`mic-button ${pushToTalk ? 'push-to-talk' : ''} ${listening ? 'listening' : ''} ${ptt.cancelArmed ? 'cancel-armed' : ''} ${phase === 'correct' ? 'correct' : ''}`}
                  style={pushToTalk ? ptt.buttonStyle : undefined}
                  {...micHandlers}
                  title={pushToTalk ? t('common.holdToTalk') : listening ? t('common.cancelRecording') : t('common.speak')}
                  disabled={micDisabled}
                >
                  {ptt.cancelArmed ? <X size={28} /> : listening ? <Square size={28} /> : phase === 'correct' ? <Check size={28} /> : <Mic size={28} />}
                </button>
              ) : (
                <button className="mic-button" disabled>
                  <MicOff size={28} />
                </button>
              )}
              {phase === 'answering' && <span className="speech-state-label">{micLabel}</span>}
              {phase === 'answering' && !listening && (
                <div className="answer-help-actions">
                  <button className="btn btn-ghost btn-sm" onClick={reveal}>
                    <Eye size={14} /> {t('words.showAnswer')}
                  </button>
                </div>
              )}
            </div>
            {micError && <div className="alert alert-error" style={{ maxWidth: 500, width: '100%' }}>{micError}</div>}
          </>
        )}

        {phase === 'correct' && (
          <div className="correct-flash animate-in">
            <Check size={20} /> {t('words.correct')}
          </div>
        )}

        {/* Say questions: a wrong answer can be tried again before the answer is shown */}
        {phase === 'wrong' && !isChoice && (
          <div className="feedback-panel feedback-incorrect vocab-feedback animate-in">
            <div className="feedback-title">
              <RotateCcw size={20} /> {t('words.wrong')}
            </div>
            <p className="feedback-text">{t('words.yourAnswer', { answer: lastAnswer })}</p>
            <div className="vocab-actions">
              <button className="btn btn-secondary" onClick={reveal}>
                <Eye size={16} /> {t('words.showAnswer')}
              </button>
              <button className="btn btn-primary" onClick={tryAgain}>
                <RotateCcw size={16} /> {t('words.tryAgain')}
              </button>
            </div>
          </div>
        )}

        {showAnswerCard && (
          <div className="vocab-answer animate-in">
            <div className="vocab-answer-label">
              {phase === 'revealed' ? t('words.revealed') : t('words.wrong')}
            </div>
            {question.practice ? (
              <>
                <div className="vocab-answer-body">
                  <span className="vocab-word jp-text" lang="ja">{question.practice.word.written}</span>
                  <span className="vocab-reading kanji-practice-reading jp-text" lang="ja"><PracticeReading q={question.practice} /></span>
                </div>
                <div className="kanji-practice-answer-reading">
                  <span className="jp-text" lang="ja">{entry.kanji}</span> · {t(question.practice.onyomi ? 'kanjiList.onyomi' : 'kanjiList.kunyomi')}{' '}
                  <span className="jp-text" lang="ja">{readingLabel(question.practice)}</span>
                  {question.practice.word.readings.length > 1 && (
                    <> · {t('kanjiList.practice.alsoRead', { readings: question.practice.word.readings.filter((r) => r !== question.practice?.said).join('、') })}</>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="vocab-answer-body">
                  <span className="vocab-word jp-text" lang="ja">{entry.kanji}</span>
                  <span className="vocab-reading jp-text" lang="ja">{allReadings(entry)}</span>
                </div>
                <div className="vocab-answer-meaning">{entry.meanings.join(', ')}</div>
              </>
            )}
            <button className="btn btn-primary btn-lg" onClick={goNext} autoFocus>
              {isLast ? t('words.seeResults') : t('words.next')} <SkipForward size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
