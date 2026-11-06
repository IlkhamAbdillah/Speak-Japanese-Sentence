import { useEffect, useRef, useState } from 'react';
import { Check, Delete, Eye, Loader2, RotateCcw, SkipForward, Sparkles, Trophy, Volume2, X } from 'lucide-react';
import type { ParticleQuestion } from '../services/particles';
import { blanksOf, isParticlePrefix, isParticleRight, PARTICLE_KEYS, particleFromRomaji } from '../services/particles';
import type { ParticleVerdict } from '../services/particleAI';
import { inLanguage, patternLabel } from '../services/grammar';
import { isSpeechSynthesisSupported, prefersPushToTalk, speakJapanese } from '../services/speech';
import ConfirmDialog from './ConfirmDialog';
import SettingsButton from './SettingsButton';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useI18n } from '../i18n';

interface ParticleQuizProps {
  questions: ParticleQuestion[];
  /** Ask these sentences again (Retry wrong) */
  onRetry: (wrong: ParticleQuestion[]) => void;
  /** Back to the practice options */
  onExit: () => void;
  /** Ask the AI whether the learner's particles work too; missing without an AI set up */
  onJudge?: (question: ParticleQuestion, answers: string[]) => Promise<ParticleVerdict>;
  /** Next to an AI error (the AI settings may be wrong) */
  onOpenSettings?: () => void;
  /** The keypad / romaji tip under the keypad (off when the How to answer screen showed it) */
  showTypeTip?: boolean;
}

/** How long "Correct!" stays on screen before the next question, as in the other quizzes. */
const CORRECT_ADVANCE_MS = 1200;

// answering → correct (auto-advance) | wrong (Try again / Show answer / Ask AI) → revealed | accepted (the AI says it works)
type Phase = 'answering' | 'correct' | 'wrong' | 'revealed' | 'accepted';

/**
 * Particle practice: a sentence with particles blanked out (and its translation); each
 * blank is filled from the keypad or by typing the particle's romaji (wa, ni, kara…).
 * The answer is checked as soon as the last blank is filled. A wrong answer can be tried
 * again, shown, or (with an AI) checked by the AI when the learner thinks it works too.
 * Score = right on the first try without Show answer. Nothing is saved.
 */
export default function ParticleQuiz({ questions, onRetry, onExit, onJudge, onOpenSettings, showTypeTip = true }: ParticleQuizProps) {
  const { t, lang } = useI18n();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('answering');
  const [outcomes, setOutcomes] = useState<boolean[]>([]);
  const [answers, setAnswers] = useState<(string | undefined)[]>([]);
  const [active, setActive] = useState(0);
  const [typed, setTyped] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [verdict, setVerdict] = useState<{ loading: boolean; result?: ParticleVerdict; error?: string } | null>(null);

  const finished = index >= questions.length;
  const question = questions[index] as ParticleQuestion | undefined;
  const blanks = question ? blanksOf(question) : [];
  const answered = phase !== 'answering';
  const showRight = phase === 'revealed';
  const pushToTalk = prefersPushToTalk();

  const record = (correct: boolean, override = false) => {
    setOutcomes((prev) => {
      if (prev[index] !== undefined && !override) return prev;
      const next = [...prev];
      next[index] = correct;
      return next;
    });
  };

  const goNext = () => {
    setAnswers([]);
    setActive(0);
    setTyped('');
    setAttempts(0);
    setVerdict(null);
    setPhase('answering');
    setIndex((i) => i + 1);
  };

  const check = (filled: (string | undefined)[]) => {
    const correct = blanks.every((b, i) => isParticleRight(b, filled[i]));
    setAttempts((n) => n + 1);
    record(correct);
    setPhase(correct ? 'correct' : 'wrong');
  };

  const fill = (particle: string) => {
    if (phase !== 'answering') return;
    const next = [...answers];
    next[active] = particle;
    setAnswers(next);
    setTyped('');
    // The next empty blank after this one, else the first empty one; none left = check
    const after = blanks.findIndex((_, i) => i > active && !next[i]);
    const empty = after >= 0 ? after : blanks.findIndex((_, i) => !next[i]);
    if (empty < 0) check(next);
    else setActive(empty);
  };

  // Tapping a blank selects it (and clears what was in it)
  const selectBlank = (i: number) => {
    if (phase !== 'answering') return;
    const next = [...answers];
    next[i] = undefined;
    setAnswers(next);
    setActive(i);
    setTyped('');
  };

  // Backspace: the typed letters first, then the blank before the selected one
  const backspace = () => {
    if (phase !== 'answering') return;
    if (typed) return setTyped(typed.slice(0, -1));
    const target = answers[active] ? active : active - 1;
    if (target >= 0) selectBlank(target);
  };

  const tryAgain = () => {
    // Only the wrong blanks are emptied
    const next = answers.map((a, i) => (isParticleRight(blanks[i], a) ? a : undefined));
    setAnswers(next);
    setActive(Math.max(0, next.findIndex((a) => !a)));
    setVerdict(null);
    setPhase('answering');
  };

  const reveal = () => {
    record(false);
    setPhase('revealed');
  };

  const askAI = async () => {
    if (!onJudge || !question) return;
    setVerdict({ loading: true });
    try {
      const result = await onJudge(question, blanks.map((_, i) => answers[i] ?? ''));
      setVerdict({ loading: false, result });
      if (result.correct) {
        // Right on the first try after all
        if (attempts === 1) record(true, true);
        setPhase('accepted');
      }
    } catch (err) {
      setVerdict({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  };

  // The keyboard handler reads the latest state through refs
  const actions = { fill, backspace, tryAgain, reveal, goNext, typed, phase };
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  const [confirmExit, setConfirmExit] = useState(false);
  useEscapeKey(() => setConfirmExit(true), !finished && !confirmExit);

  useEffect(() => {
    if (phase !== 'correct') return;
    const timer = setTimeout(() => actionsRef.current.goNext(), CORRECT_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [phase, index]);

  // Keyboard: type a particle's romaji (wa, ni, kara…; Space/Enter when it could go on,
  // like ka → kara), Backspace; after a wrong answer R = Try again, Enter = Show answer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const a = actionsRef.current;
      const key = e.key.toLowerCase();
      if (a.phase === 'answering') {
        if (/^[a-z]$/.test(key)) {
          const buffer = a.typed + key;
          if (!isParticlePrefix(buffer)) {
            // "ka" then "w": か was meant, and "w" starts the next one
            const done = particleFromRomaji(a.typed).particle;
            if (!done || !isParticlePrefix(key)) return;
            // One blank per key press (the state of this render is used); Space/the next key finishes it
            e.preventDefault();
            a.fill(done);
            setTyped(key);
            return;
          }
          e.preventDefault();
          const { particle, ambiguous } = particleFromRomaji(buffer);
          if (particle && !ambiguous) a.fill(particle);
          else setTyped(buffer);
        } else if ((e.key === ' ' || e.key === 'Enter') && a.typed) {
          e.preventDefault();
          const { particle } = particleFromRomaji(a.typed);
          if (particle) a.fill(particle);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          a.backspace();
        }
        return;
      }
      if (e.target instanceof HTMLButtonElement && e.key === 'Enter') return;
      if (a.phase === 'wrong') {
        if (key === 'r') a.tryAgain();
        else if (e.key === 'Enter') a.reveal();
      } else if ((a.phase === 'revealed' || a.phase === 'accepted') && e.key === 'Enter') {
        a.goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finished]);

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
              {t('particles.newPractice')}
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
            <h3 className="card-title">{t('particles.review')}</h3>
            <div className="vocab-list">
              {wrong.map((q) => (
                <div key={q.id} className="particle-review-row">
                  <p className="jp-text" lang="ja">
                    {q.segments.map((s, i) => (s.mark ? <mark key={i} className="grammar-mark">{s.text}</mark> : <span key={i}>{s.text}</span>))}
                  </p>
                  <p className="grammar-example-translation">{q.translation}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ─── Question ─────────────────────────────────────────
  const isLast = index === questions.length - 1;
  const canSpeak = isSpeechSynthesisSupported();
  let blankNo = 0;

  // Why each blank takes its particle: the AI's explanation, or the list use it is an example of
  const reasons = blanks.map((_, i) =>
    question.explanations?.[i] ||
    (question.point ? `${patternLabel(question.point)}: ${inLanguage(question.point.meaning, lang)}` : ''));
  const answerCard = (
    <div className="particle-reasons">
      {blanks.map((b, i) => reasons[i] && (
        <p key={i}><span className="jp-text particle-reason-key" lang="ja">{(b.accepted ?? [b.text]).join(' / ')}</span> {reasons[i]}</p>
      ))}
    </div>
  );

  const sheet = phase === 'correct' ? (
    <div className="kanji-sheet kanji-sheet-correct animate-in">
      <Check size={20} /> {t('words.correct')}
    </div>
  ) : phase === 'wrong' ? (
    <div className="kanji-sheet kanji-sheet-wrong particle-sheet animate-in">
      <div className="kanji-sheet-main">
        <div className="kanji-sheet-title">
          <RotateCcw size={18} /> {t('words.wrong')}
        </div>
        {verdict?.result && !verdict.result.correct && (
          <p className="particle-verdict"><Sparkles size={14} /> {verdict.result.explanation}</p>
        )}
        {verdict?.error && (
          <p className="particle-verdict particle-verdict-error">
            <span>{verdict.error}</span>
            {onOpenSettings && <SettingsButton onClick={onOpenSettings} />}
          </p>
        )}
        {!pushToTalk && (
          <div className="vocab-tip kanji-practice-keys">
            <p>{t('kanjiList.practice.tryAgainKey')}</p>
            <p>{t('kanjiList.practice.showAnswerKey')}</p>
          </div>
        )}
        {/* The learner thinks their particle works too: the AI decides */}
        {onJudge && !verdict?.result && (
          <button className="btn btn-ghost btn-sm particle-ask" onClick={askAI} disabled={verdict?.loading}>
            {verdict?.loading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Sparkles size={14} />} {t('particles.askAI')}
          </button>
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
  ) : phase === 'revealed' || phase === 'accepted' ? (
    <div className={`kanji-sheet kanji-sheet-answer particle-sheet ${phase === 'accepted' ? 'particle-sheet-accepted' : ''} animate-in`}>
      <div className="kanji-sheet-main">
        <div className="vocab-answer-label">{phase === 'accepted' ? t('particles.accepted') : t('words.revealed')}</div>
        {phase === 'accepted' && verdict?.result?.explanation && (
          <p className="particle-verdict"><Sparkles size={14} /> {verdict.result.explanation}</p>
        )}
        {answerCard}
      </div>
      <div className="kanji-sheet-actions">
        <button className="btn btn-primary btn-lg" onClick={goNext} autoFocus>
          {isLast ? t('words.seeResults') : t('words.next')} <SkipForward size={16} />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="vocab-quiz kanji-quiz particle-quiz">
      <div className="kanji-quiz-top">
        <div className="session-header">
          <div className="session-info">
            <span className="kanji-quiz-count">{t('words.questionOf', { current: index + 1, total: questions.length })}</span>
            <span className="badge badge-success"><Check size={12} /> {outcomes.filter(Boolean).length}</span>
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
          <p className="question-context">{t(blanks.length > 1 ? 'particles.instructionMany' : 'particles.instruction')}</p>
          <p className="grammar-quiz-sentence particle-sentence jp-text" lang="ja">
            {question.segments.map((s, i) => {
              if (!s.mark) return <span key={i}>{s.text}</span>;
              const b = blankNo++;
              const given = answers[b];
              const shown = showRight ? s.text : given;
              const state = phase === 'answering'
                ? (b === active ? 'active' : '')
                : showRight || isParticleRight(s, given) || phase === 'accepted' ? 'right' : 'wrong';
              return (
                <button
                  key={i}
                  className={`particle-blank ${state} ${shown ? 'filled' : ''}`}
                  onClick={() => selectBlank(b)}
                  disabled={answered}
                  aria-label={t('particles.blank', { n: b + 1 })}
                >
                  {shown ?? (b === active && typed ? typed : '　')}
                </button>
              );
            })}
          </p>
          {/* The right sentence can be heard once it's on screen */}
          {(phase === 'correct' || phase === 'revealed' || phase === 'accepted') && canSpeak && (
            <button
              className="btn btn-ghost btn-icon grammar-listen grammar-quiz-listen"
              onClick={() => speakJapanese(question.text)}
              title={t('words.listen')}
              aria-label={t('words.listen')}
            >
              <Volume2 size={16} />
            </button>
          )}
          <p className="grammar-quiz-translation">{question.translation}</p>
        </div>

        <div className="particle-keypad" role="group" aria-label={t('particles.keypad')}>
          {PARTICLE_KEYS.map((p) => (
            <button key={p} className="particle-key jp-text" lang="ja" onClick={() => fill(p)} disabled={answered}>
              {p}
            </button>
          ))}
          <button className="particle-key particle-key-back" onClick={backspace} disabled={answered} aria-label={t('particles.clear')} title={t('particles.clear')}>
            <Delete size={18} />
          </button>
        </div>
        {!answered && !pushToTalk && showTypeTip && <p className="vocab-tip particle-tip">{t('particles.typeTip')}</p>}
      </div>

      <div className="kanji-sheet-slot">{sheet}</div>
    </div>
  );
}
