import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Check, Play, RefreshCw, RotateCcw } from 'lucide-react';
import type { DailyItemResult, DailyMistake, DailyPart, DailyPlan, DailyRun, QuizProgress, UserSettings } from '../types';
import { DAILY_PARTS, hasAISetup } from '../types';
import {
  loadDailyPlan,
  loadGrammarProgress,
  loadKanjiProgress,
  saveDailyPlan,
  saveGrammarProgress,
  saveKanjiProgress,
  todayKey,
  updateDailyMistakes,
} from '../services/storage';
import { buildDailyPlan, dailyGrammar, dailyKanji, DAILY_PARTICLES, grammarByKey, kanjiByChar } from '../services/daily';
import type { KanjiQuestion } from '../services/kanjiQuiz';
import { buildKanjiPractice, practiceWordsFor, PRACTICE_QUESTION_COUNT } from '../services/kanjiPractice';
import { kanjiStatus, recordKanjiResult } from '../services/kanjiProgress';
import type { GrammarPracticeQuestion } from '../services/grammarPractice';
import { evaluateGrammarAnswer, generateGrammarPractice, PRACTICE_SENTENCES } from '../services/grammarPractice';
import type { GrammarPoint } from '../services/grammar';
import { grammarKey, recordGrammarResult } from '../services/grammarProgress';
import type { ParticleQuestion } from '../services/particles';
import { blanksOf } from '../services/particles';
import { generateParticleQuestions, judgeParticleAnswer } from '../services/particleAI';
import type { ReviewState, ReviewStatus } from '../services/review';
import { fromNow, isDue, KNOWN_STREAK, PRACTICE_PASS_RATE, reviewStatus } from '../services/review';
import { aiConfigFromSettings } from '../services/ai';
import KanjiQuiz from '../components/KanjiQuiz';
import GrammarPractice from '../components/GrammarPractice';
import ParticleQuiz from '../components/ParticleQuiz';
import GeneratingScreen from '../components/GeneratingScreen';
import AnswerTips from '../components/AnswerTips';
import SettingsButton from '../components/SettingsButton';
import { Kbd } from '../components/Kbd';
import { languageMeta, useI18n } from '../i18n';

interface DailyPageProps {
  settings: UserSettings;
}

type View = 'plan' | DailyPart;

interface Generated<Q> {
  status: 'loading' | 'ready' | 'error';
  questions?: Q[];
  error?: string;
}

// ─── Saving a part's questions ──────────────────────────
// A run is saved in sjp_daily so it resumes after leaving. Kanji questions are saved as
// kanji + word (rebuilt from the word list), grammar questions with the point's key.

interface SavedKanjiQuestion { k: string; w: string }
type SavedGrammarQuestion = Omit<GrammarPracticeQuestion, 'point'> & { p: string };

const saveKanjiQuestion = (q: KanjiQuestion): SavedKanjiQuestion => ({ k: q.entry.kanji, w: q.practice.word.written });
function loadKanjiQuestion(saved: SavedKanjiQuestion): KanjiQuestion | null {
  const entry = kanjiByChar(saved.k);
  const words = entry ? practiceWordsFor(entry) : [];
  const practice = words.find((q) => q.word.written === saved.w) ?? words[0];
  return entry && practice ? { entry, type: 'word', practice } : null;
}

const saveGrammarQuestion = ({ point, ...q }: GrammarPracticeQuestion): SavedGrammarQuestion => ({ ...q, p: grammarKey(point!) });
function loadGrammarQuestion({ p, ...q }: SavedGrammarQuestion): GrammarPracticeQuestion | null {
  const point = grammarByKey(p);
  return point ? { ...q, point } : null;
}

/** The saved questions of a part, ready for its quiz (an item that no longer exists is dropped) */
function loadQuestions(part: 'kanji', saved?: unknown[]): KanjiQuestion[];
function loadQuestions(part: 'grammar', saved?: unknown[]): GrammarPracticeQuestion[];
function loadQuestions(part: 'particles', saved?: unknown[]): ParticleQuestion[];
function loadQuestions(part: DailyPart, saved?: unknown[]): unknown[] {
  if (!saved) return [];
  if (part === 'kanji') return (saved as SavedKanjiQuestion[]).flatMap((q) => loadKanjiQuestion(q) ?? []);
  if (part === 'grammar') return (saved as SavedGrammarQuestion[]).flatMap((q) => loadGrammarQuestion(q) ?? []);
  return saved as ParticleQuestion[];
}

// ─── Mistakes ───────────────────────────────────────────

const mistakeKey = (date: string, part: DailyPart, q: unknown): string => {
  if (part === 'kanji') return `${date}:kanji:${(q as KanjiQuestion).entry.kanji}:${(q as KanjiQuestion).practice.word.written}`;
  return `${date}:${part}:${(q as GrammarPracticeQuestion | ParticleQuestion).id}`;
};

/** A question answered wrong, as the Mistakes page shows it */
function mistakeFor(plan: DailyPlan, part: DailyPart, q: unknown, answer: string): DailyMistake {
  const base = { key: mistakeKey(plan.date, part, q), date: plan.date, part, at: Date.now(), answer };
  if (part === 'kanji') {
    const { entry, practice } = q as KanjiQuestion;
    return { ...base, level: entry.level, prompt: practice.word.written, correct: practice.said, detail: practice.word.meaning };
  }
  if (part === 'grammar') {
    const g = q as GrammarPracticeQuestion;
    return { ...base, level: g.point?.level, prompt: g.prompt, correct: g.example.text, detail: g.point?.pattern };
  }
  const p = q as ParticleQuestion;
  return {
    ...base,
    level: plan.particleLevel,
    prompt: p.segments.map((s) => (s.mark ? `[${s.text}]` : s.text)).join(''),
    correct: blanksOf(p).map((b) => b.text).join(' / '),
    detail: p.translation,
  };
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Questions grouped by item: right on the first try / asked */
function tally<Q>(questions: Q[], outcomes: boolean[], keyOf: (q: Q) => string) {
  const groups = new Map<string, { right: number; total: number }>();
  questions.forEach((q, i) => {
    const g = groups.get(keyOf(q)) ?? { right: 0, total: 0 };
    g.total++;
    if (outcomes[i]) g.right++;
    groups.set(keyOf(q), g);
  });
  return groups;
}

const passes = (right: number, total: number) => right >= Math.ceil(total * PRACTICE_PASS_RATE);

const sameList = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** The AI couldn't write a part's questions: Back · Settings · Retry. */
function GenerationError({ message, onBack, onSettings, onRetry }: { message?: string; onBack: () => void; onSettings: () => void; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="app-main">
      <div className="empty-state">
        <p className="empty-state-title">{t('grammar.practice.generationFailed')}</p>
        {message && (
          <div className="alert alert-error" style={{ maxWidth: 500, margin: 'var(--space-md) auto', textAlign: 'left' }}>
            <AlertCircle size={16} />
            <span>{message}</span>
          </div>
        )}
        <div className="action-row" style={{ marginTop: 'var(--space-lg)' }}>
          <button className="btn btn-secondary" onClick={onBack}>{t('common.back')}</button>
          <SettingsButton onClick={onSettings} large />
          <button className="btn btn-primary" onClick={onRetry}>
            <RotateCcw size={16} /> {t('common.retry')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Daily Learning (user-requested): one set a day without picking menus. The kanji
 * reading practice of 5 kanji, the grammar practice of 5 points (AI) and 5 particle
 * sentences (AI), in that order; within a part the items come one after the other
 * (the first kanji's 5 words, then the second's…). The picks come from services/daily.ts
 * and stay for the day. Each part's first run is saved as it goes, so leaving and
 * coming back continues at the same question, and a finished part opens on its results.
 * That run counts for the progress like a practice from the item's card; its wrong
 * answers go to the Mistakes page (grouped by day).
 */
export default function DailyPage({ settings }: DailyPageProps) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const locale = languageMeta(lang).locale;
  const hasAI = hasAISetup(settings);
  const openSettings = () => navigate('/settings', { state: { from: '/daily' } });

  const [kanjiProgress, setKanjiProgress] = useState(loadKanjiProgress);
  const [grammarProgress, setGrammarProgress] = useState(loadGrammarProgress);
  const [plan, setPlan] = useState<DailyPlan>(() => {
    const saved = loadDailyPlan();
    return saved && saved.date === todayKey() ? saved : buildDailyPlan(loadKanjiProgress(), loadGrammarProgress());
  });
  useEffect(() => {
    saveDailyPlan(plan);
  }, [plan]);

  const kanji = useMemo(() => dailyKanji(plan), [plan]);
  const grammar = useMemo(() => dailyGrammar(plan), [plan]);
  const runs = plan.runs ?? {};
  const kanjiCount = useMemo(
    () => kanji.reduce((n, e) => n + Math.min(PRACTICE_QUESTION_COUNT, practiceWordsFor(e).length), 0),
    [kanji]
  );
  const counts: Record<DailyPart, number> = {
    kanji: runs.kanji?.questions.length ?? kanjiCount,
    grammar: runs.grammar?.questions.length ?? grammar.length * PRACTICE_SENTENCES,
    particles: runs.particles?.questions.length ?? DAILY_PARTICLES,
  };
  const available = (part: DailyPart) =>
    !!runs[part] || (part === 'kanji' ? kanji.length > 0 : hasAI && (part === 'particles' || grammar.length > 0));

  // The saved runs as quiz questions (rebuilt only when a part's questions change)
  const savedKanji = runs.kanji?.questions;
  const savedGrammar = runs.grammar?.questions;
  const savedParticles = runs.particles?.questions;
  const kanjiQuestions = useMemo(() => loadQuestions('kanji', savedKanji), [savedKanji]);
  const grammarQuestions = useMemo(() => loadQuestions('grammar', savedGrammar), [savedGrammar]);
  const particleQuestions = useMemo(() => loadQuestions('particles', savedParticles), [savedParticles]);

  const [view, setView] = useState<View>('plan');
  // Retry wrong: the wrong questions again, not saved and not counted
  const [retry, setRetry] = useState<{ part: DailyPart; questions: unknown[] } | null>(null);
  const [runNumber, setRunNumber] = useState(0);
  const retryCleared = useRef(new Set<string>());

  // ─── AI parts: written in the background (prefetched one part ahead) ───
  const [grammarGen, setGrammarGen] = useState<Generated<GrammarPracticeQuestion> | null>(null);
  const [particleGen, setParticleGen] = useState<Generated<ParticleQuestion> | null>(null);
  const grammarGenId = useRef(0);
  const particleGenId = useRef(0);

  const generateGrammar = async () => {
    const id = ++grammarGenId.current;
    setGrammarGen({ status: 'loading' });
    const ai = aiConfigFromSettings(settings);
    // One call per point, in parallel; a failed one is tried once more
    const one = (point: GrammarPoint) =>
      generateGrammarPractice(ai, point, lang).catch(() => generateGrammarPractice(ai, point, lang));
    const results = await Promise.allSettled(grammar.map(one));
    if (id !== grammarGenId.current) return;
    // In the points' order: the first point's sentences, then the second's…
    const questions = results.flatMap((r, i) => (r.status === 'fulfilled'
      ? r.value.map((q) => ({ ...q, id: `${grammar[i].id}-${q.id}`, point: grammar[i] }))
      : []));
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    setGrammarGen(questions.length > 0
      ? { status: 'ready', questions }
      : { status: 'error', error: failed ? errorText(failed.reason) : '' });
  };

  const generateParticles = async () => {
    const id = ++particleGenId.current;
    setParticleGen({ status: 'loading' });
    try {
      const questions = await generateParticleQuestions(aiConfigFromSettings(settings), plan.particleLevel, lang, DAILY_PARTICLES);
      if (id === particleGenId.current) setParticleGen({ status: 'ready', questions });
    } catch (err) {
      if (id === particleGenId.current) setParticleGen({ status: 'error', error: errorText(err) });
    }
  };

  const setRun = (part: DailyPart, run: DailyRun) =>
    setPlan((p) => ({ ...p, runs: { ...p.runs, [part]: run } }));
  const newRun = (questions: unknown[]): DailyRun => ({ questions, index: 0, outcomes: [], answers: [] });

  // Opens a part: its saved run (in progress or its results), else a new one
  const open = (part: DailyPart) => {
    if (!available(part)) return;
    setRetry(null);
    setRunNumber((n) => n + 1);
    setView(part);
    if (part === 'kanji') {
      if (!runs.kanji) {
        // One kanji after the other, its words in random order
        const questions = kanji.flatMap((entry) =>
          buildKanjiPractice(entry).map((q) => ({ entry, type: 'word' as const, practice: q })));
        setRun('kanji', newRun(questions.map(saveKanjiQuestion)));
      }
      // Write the grammar sentences while the kanji are practised
      if (hasAI && !runs.grammar && grammar.length > 0 && !grammarGen) generateGrammar();
    } else if (part === 'grammar') {
      if (!runs.grammar && (!grammarGen || grammarGen.status === 'error')) generateGrammar();
      if (runs.grammar && hasAI && !runs.particles && !particleGen) generateParticles();
    } else if (!runs.particles && (!particleGen || particleGen.status === 'error')) {
      generateParticles();
    }
  };

  const startGrammarRun = () => {
    if (grammarGen?.status !== 'ready' || !grammarGen.questions) return;
    setRun('grammar', newRun(grammarGen.questions.map(saveGrammarQuestion)));
    if (hasAI && !runs.particles && !particleGen) generateParticles();
  };
  const startParticleRun = () => {
    if (particleGen?.status !== 'ready' || !particleGen.questions) return;
    setRun('particles', newRun(particleGen.questions));
  };

  // ─── Saving progress and mistakes as the quiz goes ────
  const onRunProgress = (part: DailyPart, questions: unknown[]) => (p: QuizProgress) => {
    const run = runs[part];
    if (!run) return;
    if (run.index === p.index && sameList(run.outcomes, p.outcomes) && sameList(run.answers, p.answers)) return;
    // A question answered wrong goes to Mistakes; "Mine works too?" (particles) takes it back out
    const add: DailyMistake[] = [];
    const remove: string[] = [];
    p.outcomes.forEach((now, i) => {
      const before = run.outcomes[i];
      if (before === undefined && now === false && questions[i]) add.push(mistakeFor(plan, part, questions[i], p.answers[i] ?? ''));
      if (before === false && now === true && questions[i]) remove.push(mistakeKey(plan.date, part, questions[i]));
    });
    updateDailyMistakes(add, remove);
    setPlan((prev) => {
      const current = prev.runs?.[part];
      return current ? { ...prev, runs: { ...prev.runs, [part]: { ...current, ...p } } } : prev;
    });
  };

  // Retry wrong: a question answered right leaves the Mistakes list
  const onRetryProgress = (part: DailyPart, questions: unknown[]) => (p: QuizProgress) => {
    const remove = p.outcomes.flatMap((right, i) => {
      const key = right && questions[i] ? mistakeKey(plan.date, part, questions[i]) : null;
      return key && !retryCleared.current.has(key) ? [key] : [];
    });
    remove.forEach((key) => retryCleared.current.add(key));
    updateDailyMistakes([], remove);
  };

  // ─── Finishing a part (its first run) ─────────────────
  const finish = (part: DailyPart, items: DailyItemResult[], outcomes: boolean[], now: number) =>
    setPlan((p) => {
      const run = p.runs?.[part];
      return {
        ...p,
        done: { ...p.done, [part]: { correct: outcomes.filter(Boolean).length, total: outcomes.length } },
        runs: run ? { ...p.runs, [part]: { ...run, results: { items, at: now } } } : p.runs,
      };
    });

  const finishKanji = (outcomes: boolean[]) => {
    if (!runs.kanji || runs.kanji.results) return;
    const now = Date.now();
    const groups = tally(kanjiQuestions, outcomes, (q) => q.entry.kanji);
    let progress = kanjiProgress;
    const items: DailyItemResult[] = [];
    for (const entry of kanji) {
      const g = groups.get(entry.kanji);
      if (!g) continue;
      const passed = passes(g.right, g.total);
      const before = progress[entry.kanji];
      progress = recordKanjiResult(progress, entry.kanji, entry.level, {
        correct: passed,
        firstTry: passed,
        words: kanjiQuestions.filter((q) => q.entry.kanji === entry.kanji).map((q) => q.practice.word.written),
      }, now);
      const { streak, dueAt } = progress[entry.kanji];
      items.push({ label: entry.kanji, ...g, passed, early: passed && !!before && !isDue(before, now), after: { streak, dueAt } });
    }
    saveKanjiProgress(progress);
    setKanjiProgress(progress);
    finish('kanji', items, outcomes, now);
  };

  const finishGrammar = (outcomes: boolean[]) => {
    if (!runs.grammar || runs.grammar.results) return;
    const now = Date.now();
    const groups = tally(grammarQuestions, outcomes, (q) => grammarKey(q.point!));
    let progress = grammarProgress;
    const items: DailyItemResult[] = [];
    for (const point of grammar) {
      const key = grammarKey(point);
      const g = groups.get(key);
      if (!g) continue;
      const passed = passes(g.right, g.total);
      const before = progress[key];
      progress = recordGrammarResult(progress, point, passed, now);
      const { streak, dueAt } = progress[key];
      items.push({ label: point.pattern, ...g, passed, early: passed && !!before && !isDue(before, now), after: { streak, dueAt } });
    }
    saveGrammarProgress(progress);
    setGrammarProgress(progress);
    finish('grammar', items, outcomes, now);
  };

  const finishParticles = (outcomes: boolean[]) => {
    if (!runs.particles || runs.particles.results) return;
    finish('particles', [], outcomes, Date.now());
  };

  // ─── Results card ─────────────────────────────────────
  const resultLine = (r: DailyItemResult, now: number) => {
    const date = fromNow(r.after.dueAt, now, locale);
    const status: ReviewStatus = reviewStatus(r.after);
    const text = !r.passed
      ? t('daily.result.notCounted', { right: r.right, total: r.total, date })
      : r.early
        ? t('daily.result.early', { date })
        : status === 'known'
          ? t('daily.result.mastered', { date })
          : t('daily.result.counted', { streak: r.after.streak, known: KNOWN_STREAK, date });
    return (
      <span key={r.label} className={`daily-result-line ${r.passed ? 'passed' : 'failed'}`}>
        <span className="daily-result-label jp-text" lang="ja">{r.label}</span>
        <span>{text}</span>
      </span>
    );
  };
  const noteFor = (part: DailyPart) => {
    const results = runs[part]?.results;
    if (retry || !results || results.items.length === 0) return undefined;
    return <span className="daily-result-lines">{results.items.map((r) => resultLine(r, results.at))}</span>;
  };

  const startRetry = (part: DailyPart) => (wrong: unknown[]) => {
    retryCleared.current.clear();
    setRetry({ part, questions: [...wrong].sort(() => Math.random() - 0.5) });
    setRunNumber((n) => n + 1);
  };

  const backToPlan = () => {
    setView('plan');
    setRetry(null);
  };

  // The results card carries on with the next part still to do, else back to the plan
  const nextAfter = (part: DailyPart): DailyPart | undefined =>
    DAILY_PARTS.slice(DAILY_PARTS.indexOf(part) + 1).find((p) => !plan.done[p] && available(p));
  const partProps = (part: DailyPart, questions: unknown[]) => {
    const next = nextAfter(part);
    const run = runs[part];
    const isRetry = retry?.part === part;
    return {
      onExit: backToPlan,
      onNext: next ? () => open(next) : backToPlan,
      nextLabel: next ? t('daily.nextPart', { part: t(`daily.part.${next}`) }) : t('daily.finish'),
      exitLabel: t('daily.back'),
      initial: isRetry ? undefined : run,
      onProgress: isRetry ? onRetryProgress(part, questions) : onRunProgress(part, questions),
    };
  };

  const remaining = DAILY_PARTS.filter((p) => !plan.done[p] && available(p));
  const allDone = remaining.length === 0;
  const newRound = () => {
    grammarGenId.current++;
    particleGenId.current++;
    setGrammarGen(null);
    setParticleGen(null);
    setPlan(buildDailyPlan(kanjiProgress, grammarProgress));
  };

  // Plan: Enter opens the next part (or starts a new round)
  const primaryRef = useRef<() => void>(() => {});
  useEffect(() => {
    primaryRef.current = allDone ? newRound : () => open(remaining[0]);
  });
  useEffect(() => {
    if (view !== 'plan') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat || e.isComposing || e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      primaryRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view]);

  // ─── Kanji part ───────────────────────────────────────
  if (view === 'kanji' && runs.kanji) {
    const questions = retry?.part === 'kanji' ? (retry.questions as KanjiQuestion[]) : kanjiQuestions;
    return (
      <div className="app-main kanji-quiz-main">
        <KanjiQuiz
          key={`kanji-${runNumber}`}
          {...partProps('kanji', questions)}
          nextTip={t('daily.nextTip')}
          exitText={t(retry ? 'daily.exitRetryText' : 'daily.exitText')}
          questions={questions}
          onRetry={startRetry('kanji')}
          onFinish={retry ? undefined : finishKanji}
          resultNote={noteFor('kanji')}
          isPractice
        />
      </div>
    );
  }

  // ─── Grammar part ─────────────────────────────────────
  if (view === 'grammar') {
    if (!runs.grammar) {
      if (grammarGen?.status === 'error') {
        return <GenerationError message={grammarGen.error} onBack={backToPlan} onSettings={openSettings} onRetry={generateGrammar} />;
      }
      return (
        <GeneratingScreen
          ready={grammarGen?.status === 'ready'}
          title={t('grammar.practice.generatingTitle')}
          text={grammar.map((p) => p.pattern).join(' · ')}
          tips={<AnswerTips kind="grammar" />}
          onBack={backToPlan}
          onStart={startGrammarRun}
        />
      );
    }
    const questions = retry?.part === 'grammar' ? (retry.questions as GrammarPracticeQuestion[]) : grammarQuestions;
    return (
      <div className="app-main kanji-quiz-main">
        <GrammarPractice
          key={`grammar-${runNumber}`}
          {...partProps('grammar', questions)}
          nextTip={t('daily.nextTip')}
          exitText={t(retry ? 'daily.exitRetryText' : 'daily.exitText')}
          questions={questions}
          evaluate={(q, answer, spoken, previous) =>
            evaluateGrammarAnswer(aiConfigFromSettings(settings), lang, q.point!, q, answer, spoken, previous)}
          onRetry={startRetry('grammar')}
          onFinish={retry ? () => {} : finishGrammar}
          onOpenSettings={openSettings}
          resultNote={noteFor('grammar')}
        />
      </div>
    );
  }

  // ─── Particle part ────────────────────────────────────
  if (view === 'particles') {
    if (!runs.particles) {
      if (particleGen?.status === 'error') {
        return <GenerationError message={particleGen.error} onBack={backToPlan} onSettings={openSettings} onRetry={generateParticles} />;
      }
      return (
        <GeneratingScreen
          ready={particleGen?.status === 'ready'}
          title={t('particles.generatingTitle')}
          tips={<AnswerTips kind="particle" />}
          onBack={backToPlan}
          onStart={startParticleRun}
        />
      );
    }
    const questions = retry?.part === 'particles' ? (retry.questions as ParticleQuestion[]) : particleQuestions;
    return (
      <div className="app-main kanji-quiz-main">
        <ParticleQuiz
          key={`particles-${runNumber}`}
          {...partProps('particles', questions)}
          questions={questions}
          onRetry={startRetry('particles')}
          onJudge={hasAI ? (q, answers) => judgeParticleAnswer(aiConfigFromSettings(settings), lang, q, answers) : undefined}
          onOpenSettings={openSettings}
          showTypeTip={false}
          onFinish={retry ? undefined : finishParticles}
        />
      </div>
    );
  }

  // ─── Today's plan ─────────────────────────────────────
  const dateLabel = new Date(`${plan.date}T00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const statusClass = (state: ReviewState | undefined) => `daily-item-${reviewStatus(state)}`;
  const items: Record<DailyPart, ReactNode> = {
    kanji: kanji.map((e) => (
      <span key={e.kanji} className={`daily-item daily-item-glyph ${statusClass(kanjiProgress[e.kanji])}`} lang="ja" title={t(`kanjiList.status.${kanjiStatus(kanjiProgress[e.kanji])}`)}>
        {e.kanji}
      </span>
    )),
    grammar: grammar.map((p) => (
      <span key={p.id} className={`daily-item ${statusClass(grammarProgress[grammarKey(p)])}`} lang="ja" title={t(`kanjiList.status.${reviewStatus(grammarProgress[grammarKey(p)])}`)}>
        {p.pattern}
      </span>
    )),
    particles: <span className="daily-item">{plan.particleLevel}</span>,
  };
  const meta = (part: DailyPart) => {
    const done = plan.done[part];
    if (done) return t('daily.score', { correct: done.correct, total: done.total });
    const run = runs[part];
    if (run && run.index > 0) return t('daily.inProgress', { current: Math.min(run.index + 1, run.questions.length), total: run.questions.length });
    return t('daily.questions', { count: counts[part] });
  };
  const started = Object.keys(plan.done).length > 0 || Object.values(runs).some((r) => r && r.index > 0);

  return (
    <div className="app-main daily-page">
      <section className="daily-head animate-in">
        <h1 className="daily-title">{t('daily.title')}</h1>
        <p className="daily-date">{dateLabel}</p>
      </section>

      {!hasAI && (
        <div className="alert alert-info daily-ai-notice">
          <AlertCircle size={16} />
          <span>{t('daily.needsAI')}</span>
          <SettingsButton onClick={openSettings} />
        </div>
      )}

      <div className="daily-parts animate-in">
        {DAILY_PARTS.map((part, i) => {
          const done = plan.done[part];
          return (
            <button
              key={part}
              className={`daily-part ${done ? 'done' : ''} ${!allDone && remaining[0] === part ? 'next' : ''}`}
              onClick={() => open(part)}
              disabled={!available(part)}
            >
              <span className="daily-part-step">{done ? <Check size={18} /> : i + 1}</span>
              <span className="daily-part-body">
                <span className="daily-part-head">
                  <span className="daily-part-title">{t(`daily.part.${part}`)}</span>
                  <span className="daily-part-meta">{meta(part)}</span>
                </span>
                <span className="daily-part-items">{items[part]}</span>
              </span>
            </button>
          );
        })}
      </div>

      {allDone && <p className="daily-done">{t('daily.allDone')}</p>}

      <div className="action-row daily-actions">
        <button className="btn btn-secondary btn-lg" onClick={() => navigate('/')}>
          {t('header.home')}
        </button>
        {allDone ? (
          <button className="btn btn-primary btn-lg" onClick={newRound}>
            <RefreshCw size={18} /> {t('daily.newRound')} <Kbd k="Enter" />
          </button>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={() => open(remaining[0])}>
            <Play size={18} />
            {started ? t('daily.continue', { part: t(`daily.part.${remaining[0]}`) }) : t('daily.start')}
            <Kbd k="Enter" />
          </button>
        )}
      </div>
    </div>
  );
}
