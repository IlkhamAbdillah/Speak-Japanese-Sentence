import { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, SkipForward, Trophy, Volume2, X } from 'lucide-react';
import type { GrammarPoint, GrammarQuestion } from '../services/grammar';
import { inLanguage } from '../services/grammar';
import { isSpeechSynthesisSupported, speakJapanese } from '../services/speech';
import MultipleChoice from './MultipleChoice';
import ConfirmDialog from './ConfirmDialog';
import { GrammarRow, GrammarSentence } from './GrammarRow';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useI18n } from '../i18n';

interface GrammarQuizProps {
  questions: GrammarQuestion[];
  /** Ask these questions again (Retry wrong) */
  onRetry: (wrong: GrammarQuestion[]) => void;
  /** Back to the quiz options */
  onExit: () => void;
  /** Open a grammar point's card (the list of points to review) */
  onOpen: (point: GrammarPoint) => void;
}

/** How long "Correct!" stays on screen before the next question, as in the other quizzes. */
const CORRECT_ADVANCE_MS = 1200;

type Phase = 'answering' | 'correct' | 'wrong';

/**
 * The Grammar page's quiz (same flow and layout as the kanji quiz): fill the blank in
 * an example sentence, or pick the pattern for a meaning. 4 choices, keys 1–4. A blank
 * question shows the sentence's translation: without it several endings could fit
 * (行う[そうです] / 行う[ことになった]). Checked locally; nothing is saved.
 */
export default function GrammarQuiz({ questions, onRetry, onExit, onOpen }: GrammarQuizProps) {
  const { t, lang } = useI18n();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('answering');
  // Right on the first try, per question
  const [outcomes, setOutcomes] = useState<boolean[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);

  const finished = index >= questions.length;
  const question = questions[index] as GrammarQuestion | undefined;
  const correctChoice = question?.choices.findIndex((c) => c.point.id === question.point.id) ?? -1;

  const goNext = () => {
    setChosen(null);
    setPhase('answering');
    setIndex((i) => i + 1);
  };

  const choose = (i: number) => {
    if (phase !== 'answering' || !question) return;
    const correct = i === correctChoice;
    setChosen(i);
    setOutcomes((prev) => {
      const next = [...prev];
      next[index] = correct;
      return next;
    });
    setPhase(correct ? 'correct' : 'wrong');
  };

  const goNextRef = useRef(goNext);
  const chooseRef = useRef(choose);
  useEffect(() => {
    goNextRef.current = goNext;
    chooseRef.current = choose;
  });

  // Exit / Esc asks first (user-requested)
  const [confirmExit, setConfirmExit] = useState(false);
  useEscapeKey(() => setConfirmExit(true), !finished && !confirmExit);

  // A correct answer gets no explanation: flash and move on
  useEffect(() => {
    if (phase !== 'correct') return;
    const timer = setTimeout(() => goNextRef.current(), CORRECT_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [phase, index]);

  // Keyboard: 1–4 picks a choice, Enter goes on after a wrong answer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished || e.target instanceof HTMLInputElement || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (phase === 'answering') {
        const n = Number(e.key);
        if (n >= 1 && n <= (question?.choices.length ?? 0)) chooseRef.current(n - 1);
        return;
      }
      // A focused button already handles Enter itself
      if (e.key === 'Enter' && phase === 'wrong' && !(e.target instanceof HTMLButtonElement)) goNextRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, question, finished]);

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
          <p className="vocab-score">{t('words.score', { correct: correctCount, total: questions.length })}</p>
          <p className="question-context">{wrong.length === 0 ? t('words.perfect') : `${percent}%`}</p>
          <div className="start-card-actions">
            <button className="btn btn-secondary btn-lg" onClick={onExit}>
              {t('words.newQuiz')}
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
            <h3 className="card-title">{t('grammar.review')}</h3>
            <div className="vocab-list">
              {wrong.map((q) => <GrammarRow key={q.point.id} point={q.point} onOpen={() => onOpen(q.point)} />)}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ─── Question ─────────────────────────────────────────
  const answered = phase !== 'answering';
  const isLast = index === questions.length - 1;
  const { point, example } = question;
  const canSpeak = isSpeechSynthesisSupported();

  const sheet = phase === 'correct' ? (
    <div className="kanji-sheet kanji-sheet-correct animate-in">
      <Check size={20} /> {t('words.correct')}
    </div>
  ) : phase === 'wrong' ? (
    <div className="kanji-sheet kanji-sheet-answer kanji-sheet-wrong animate-in">
      <div className="kanji-sheet-main">
        <div className="vocab-answer-label">{t('words.wrong')}</div>
        <div className="vocab-answer-body">
          <span className="vocab-word jp-text" lang="ja">{point.pattern}</span>
        </div>
        <div className="grammar-sheet-meaning">{inLanguage(point.meaning, lang)}</div>
      </div>
      <div className="kanji-sheet-actions">
        <button className="btn btn-primary btn-lg" onClick={goNext} autoFocus>
          {isLast ? t('words.seeResults') : t('words.next')} <SkipForward size={16} />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="vocab-quiz kanji-quiz grammar-quiz">
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
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmExit(true)}>
            <X size={16} /> {t('words.exit')}
          </button>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
      </div>
      {confirmExit && (
        <ConfirmDialog
          title={t('words.exitTitle')}
          text={t('words.exitText')}
          confirmLabel={t('words.exit')}
          onCancel={() => setConfirmExit(false)}
          onConfirm={onExit}
        />
      )}

      <div className="kanji-quiz-stage animate-in" key={index}>
        <div className="question-card grammar-quiz-card">
          <p className="question-context">
            {t(`grammar.quiz.instruction.${question.type}`)} · {point.level}
          </p>
          {question.type === 'blank' && example ? (
            <>
              {/* Once answered the blank shows the answer, and the sentence can be heard
                  (the button sits in the card's corner, so the card keeps its height) */}
              <p className="grammar-quiz-sentence jp-text" lang="ja">
                <GrammarSentence example={example} blank={!answered} />
              </p>
              {answered && canSpeak && (
                <button
                  className="btn btn-ghost btn-icon grammar-listen grammar-quiz-listen"
                  onClick={() => speakJapanese(example.text)}
                  title={t('words.listen')}
                  aria-label={t('words.listen')}
                >
                  <Volume2 size={16} />
                </button>
              )}
              <p className="grammar-quiz-translation">{inLanguage(example.translation, lang)}</p>
            </>
          ) : (
            <p className="question-prompt grammar-quiz-meaning">{inLanguage(point.meaning, lang)}</p>
          )}
        </div>

        <div className="kanji-quiz-choices grammar-quiz-choices">
          <MultipleChoice
            choices={question.choices.map((c) => c.label)}
            selected={chosen}
            onSelect={choose}
            result={answered && chosen !== null ? { chosen, correct: correctChoice } : null}
          />
        </div>
      </div>

      <div className="kanji-sheet-slot">{sheet}</div>
    </div>
  );
}
