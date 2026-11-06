import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronDown, Info, ListOrdered, Play, RotateCcw, Search, Shuffle } from 'lucide-react';
import type { JLPTLevel, UserSettings } from '../types';
import { GRAMMAR_QUIZ_TYPES, JLPT_LEVELS, VOCAB_QUIZ_COUNTS, hasAISetup } from '../types';
import type { GrammarPoint, GrammarQuestion } from '../services/grammar';
import { buildGrammarQuiz, GRAMMAR_POINTS, matchesGrammarSearch } from '../services/grammar';
import { GrammarRow } from '../components/GrammarRow';
import GrammarDetailDialog from '../components/GrammarDetailDialog';
import GrammarInfoDialog from '../components/GrammarInfoDialog';
import GrammarQuiz from '../components/GrammarQuiz';
import GrammarPractice from '../components/GrammarPractice';
import GeneratingScreen from '../components/GeneratingScreen';
import AnswerTips from '../components/AnswerTips';
import SettingsButton from '../components/SettingsButton';
import type { GrammarPracticeQuestion } from '../services/grammarPractice';
import { evaluateGrammarAnswer, generateGrammarPractice } from '../services/grammarPractice';
import type { GrammarProgressMap } from '../services/grammarProgress';
import { grammarKey, recordGrammarResult } from '../services/grammarProgress';
import { fromNow, isDue, KNOWN_STREAK, PRACTICE_PASS_RATE, reviewStatus } from '../services/review';
import { loadGrammarProgress, saveGrammarProgress } from '../services/storage';
import { aiConfigFromSettings } from '../services/ai';
import { languageMeta, useI18n } from '../i18n';

interface GrammarPageProps {
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
}

/**
 * The grammar list (文法), N5 → N1, laid out like the Words and Kanji lists: one
 * collapsible section per level, a row per grammar point that opens its card
 * (meaning, how it attaches, example sentences). The Quiz tab tests them (no AI).
 * Particles have their own page (ParticlesPage).
 */
export default function GrammarPage({ settings, onSettingsChange }: GrammarPageProps) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'list' | 'quiz'>('list');
  const [query, setQuery] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [quiz, setQuiz] = useState<GrammarQuestion[] | null>(null);
  // Each quiz (also a retry of the wrong points) starts with fresh quiz state
  const [quizNumber, setQuizNumber] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  // Which way the card last moved (for its slide); null when just opened
  const [direction, setDirection] = useState<'next' | 'previous' | null>(null);
  const open = (id: string | null, dir: 'next' | 'previous' | null = null) => {
    setSelected(id);
    setDirection(dir);
  };
  // Sections closed while searching (the saved collapsed state is for the normal list)
  const [searchCollapsed, setSearchCollapsed] = useState<JLPTLevel[]>([]);

  const update = (partial: Partial<UserSettings>) => onSettingsChange({ ...settings, ...partial });

  const searching = query.trim() !== '';
  const visible = useMemo(
    () => (searching ? GRAMMAR_POINTS.filter((p) => matchesGrammarSearch(p, query)) : GRAMMAR_POINTS),
    [searching, query]
  );
  const sections = useMemo(
    () => JLPT_LEVELS.map((level) => ({ level, points: visible.filter((p) => p.level === level) }))
      .filter((s) => s.points.length > 0),
    [visible]
  );
  const collapsed = searching ? searchCollapsed : settings.grammarCollapsed;
  const toggleSection = (level: JLPTLevel) => {
    const next = collapsed.includes(level) ? collapsed.filter((l) => l !== level) : [...collapsed, level];
    if (searching) setSearchCollapsed(next);
    else update({ grammarCollapsed: next });
  };

  // The card steps through the points of the open sections
  const browsable = useMemo(
    () => sections.filter((s) => !collapsed.includes(s.level)).flatMap((s) => s.points),
    [sections, collapsed]
  );
  const index = browsable.findIndex((p) => p.id === selected);
  const current = index >= 0 ? browsable[index] : GRAMMAR_POINTS.find((p) => p.id === selected);

  // ─── Practice of one point (AI) ───────────────────────
  // Runs in the quiz screen; only its first run counts for the point's progress
  const [progress, setProgress] = useState<GrammarProgressMap>(() => loadGrammarProgress());
  const [practice, setPractice] = useState<{ point: GrammarPoint; questions: GrammarPracticeQuestion[]; counts: boolean } | null>(null);
  const [practiceNote, setPracticeNote] = useState<string | null>(null);
  const [practiceNumber, setPracticeNumber] = useState(0);
  // New exercises wait on the How to answer screen until Start (user-requested)
  const [practiceStarted, setPracticeStarted] = useState(false);
  // The point whose exercises the AI is writing, or failed to write
  const [generating, setGenerating] = useState<GrammarPoint | null>(null);
  const [generationError, setGenerationError] = useState<{ point: GrammarPoint; message: string } | null>(null);
  const generation = useRef(0);
  const hasAI = hasAISetup(settings);
  // Settings comes back to the grammar list (an AI error may mean wrong AI settings)
  const openSettings = () => navigate('/settings', { state: { from: '/grammar' } });

  const startPractice = async (point: GrammarPoint) => {
    const id = ++generation.current;
    setGenerationError(null);
    setPracticeStarted(false);
    setGenerating(point);
    try {
      const questions = await generateGrammarPractice(aiConfigFromSettings(settings), point, lang);
      if (id !== generation.current) return;
      setPractice({ point, questions, counts: true });
      setPracticeNote(null);
      setPracticeNumber((n) => n + 1);
    } catch (err) {
      if (id === generation.current) setGenerationError({ point, message: err instanceof Error ? err.message : String(err) });
    } finally {
      if (id === generation.current) setGenerating(null);
    }
  };
  const cancelGeneration = () => {
    generation.current++;
    setGenerating(null);
  };
  const evaluate = (q: GrammarPracticeQuestion, answer: string, spoken: boolean, previous: string[]) =>
    evaluateGrammarAnswer(aiConfigFromSettings(settings), lang, practice!.point, q, answer, spoken, previous);

  // A finished first run: enough right on the first try = a good practice (streak + 1)
  const finishPractice = (outcomes: boolean[]) => {
    if (!practice?.counts) return;
    const { point } = practice;
    const now = Date.now();
    const total = outcomes.length;
    const need = Math.ceil(total * PRACTICE_PASS_RATE);
    const passed = outcomes.filter(Boolean).length >= need;
    const before = progress[grammarKey(point)];
    const next = recordGrammarResult(progress, point, passed, now);
    saveGrammarProgress(next);
    setProgress(next);
    const after = next[grammarKey(point)];
    const date = fromNow(after.dueAt, now, languageMeta(lang).locale);
    const pattern = point.pattern;
    setPracticeNote(!passed
      ? t('kanjiList.practice.notCounted', { need, total, date })
      : before && !isDue(before, now)
        ? t('kanjiList.practice.early', { kanji: pattern, date })
        : reviewStatus(after) === 'known'
          ? t('kanjiList.practice.mastered', { kanji: pattern, date })
          : t('kanjiList.practice.counted', { streak: after.streak, known: KNOWN_STREAK, date }));
  };
  // Retry wrong: the same sentences again, in a new order; doesn't count
  const retryPractice = (wrong: GrammarPracticeQuestion[]) => {
    if (!practice) return;
    setPractice({ ...practice, counts: false, questions: [...wrong].sort(() => Math.random() - 0.5) });
    setPracticeNote(null);
    setPracticeNumber((n) => n + 1);
  };

  // ─── Quiz ─────────────────────────────────────────────
  const quizPoints = useMemo(
    () => GRAMMAR_POINTS.filter((p) => settings.grammarQuizJlpt.length === 0 || settings.grammarQuizJlpt.includes(p.level)),
    [settings.grammarQuizJlpt]
  );
  const startQuiz = () => {
    setQuiz(buildGrammarQuiz(quizPoints, settings.grammarQuizType, settings.grammarQuizCount));
    setQuizNumber((n) => n + 1);
  };
  // Retry wrong asks the same questions again, in a new order (choices reshuffled)
  const retry = (wrong: GrammarQuestion[]) => {
    const reshuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
    setQuiz(reshuffle(wrong).map((q) => ({ ...q, choices: reshuffle(q.choices) })));
    setQuizNumber((n) => n + 1);
  };
  const toggle = <V extends string>(values: readonly V[], value: V): V[] =>
    values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

  // The results card offers the next point (of the open sections, as the card steps)
  const nextPoint = (() => {
    if (!practice) return undefined;
    const list = browsable.some((p) => p.id === practice.point.id) ? browsable : GRAMMAR_POINTS;
    return list[list.findIndex((p) => p.id === practice.point.id) + 1];
  })();
  const practiseNext = () => {
    if (!nextPoint) return;
    open(nextPoint.id, 'next');
    setPractice(null);
    startPractice(nextPoint);
  };
  const exitPractice = () => {
    setPractice(null);
    setDirection(null);
  };

  const card = current && (
    <GrammarDetailDialog
      point={current}
      position={index >= 0 ? { index, total: browsable.length } : undefined}
      direction={direction}
      onPrevious={index > 0 ? () => open(browsable[index - 1].id, 'previous') : undefined}
      onNext={index >= 0 && index < browsable.length - 1 ? () => open(browsable[index + 1].id, 'next') : undefined}
      onClose={() => open(null)}
      practice={{
        progress: progress[grammarKey(current)],
        onStart: hasAI ? () => startPractice(current) : undefined,
        onAISetup: openSettings,
      }}
    />
  );

  // While the AI writes, and until Start: How to answer (user-requested, like Speaking Practice)
  if (generating || (practice && !practiceStarted)) {
    return (
      <GeneratingScreen
        ready={!generating}
        title={t('grammar.practice.generatingTitle')}
        text={(generating ?? practice?.point)?.pattern}
        tips={<AnswerTips kind="grammar" />}
        onBack={() => { cancelGeneration(); setPractice(null); setDirection(null); }}
        onStart={() => setPracticeStarted(true)}
      />
    );
  }

  if (generationError) {
    return (
      <div className="app-main">
        <div className="empty-state">
          <p className="empty-state-title">{t('grammar.practice.generationFailed')}</p>
          <div className="alert alert-error" style={{ maxWidth: 500, margin: 'var(--space-md) auto', textAlign: 'left' }}>
            <AlertCircle size={16} />
            <span>{generationError.message}</span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center', marginTop: 'var(--space-lg)' }}>
            <button className="btn btn-secondary" onClick={() => setGenerationError(null)}>
              {t('common.back')}
            </button>
            <SettingsButton onClick={openSettings} large />
            <button className="btn btn-primary" onClick={() => startPractice(generationError.point)}>
              <RotateCcw size={16} /> {t('common.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (practice) {
    return (
      <div className="app-main kanji-quiz-main">
        <GrammarPractice
          key={practiceNumber}
          point={practice.point}
          questions={practice.questions}
          evaluate={evaluate}
          onRetry={retryPractice}
          // Back to the point's card (still `selected`)
          onExit={exitPractice}
          onFinish={finishPractice}
          onOpenSettings={openSettings}
          resultNote={practiceNote}
          onNext={nextPoint ? practiseNext : undefined}
          nextLabel={nextPoint ? t('grammar.practice.next', { pattern: nextPoint.pattern }) : undefined}
        />
      </div>
    );
  }

  if (quiz) {
    return (
      <div className="app-main kanji-quiz-main">
        {card}
        <GrammarQuiz
          key={quizNumber}
          questions={quiz}
          onRetry={retry}
          onExit={() => { setQuiz(null); open(null); }}
          onOpen={(point: GrammarPoint) => open(point.id)}
        />
      </div>
    );
  }

  return (
    <div className="app-main">
      {showInfo && <GrammarInfoDialog onClose={() => setShowInfo(false)} />}
      {card}

      <section className="welcome-section vocab-header animate-in">
        <h1 className="welcome-title">{t('grammar.title')}</h1>
        <p className="welcome-subtitle">{t('grammar.subtitle')}</p>
      </section>

      <div className="vocab-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'list'} className={`vocab-tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
          <ListOrdered size={16} /> {t('grammar.tabList')}
        </button>
        <button role="tab" aria-selected={tab === 'quiz'} className={`vocab-tab ${tab === 'quiz' ? 'active' : ''}`} onClick={() => setTab('quiz')}>
          <Shuffle size={16} /> {t('words.tabQuiz')}
        </button>
      </div>

      {tab === 'quiz' ? (
        <section className="start-card vocab-panel animate-in">
          <div className="setup-field">
            <div className="setup-field-label">{t('kanjiList.quiz.levels')}</div>
            <div className="option-group">
              {JLPT_LEVELS.map((level) => (
                <button
                  key={level}
                  className={`option-pill ${settings.grammarQuizJlpt.includes(level) ? 'active' : ''}`}
                  aria-pressed={settings.grammarQuizJlpt.includes(level)}
                  onClick={() => update({ grammarQuizJlpt: toggle(settings.grammarQuizJlpt, level) })}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="setup-field-help">{t('words.quizFilterHelp')}</p>
          </div>
          <div className="setup-field">
            <div className="setup-field-label">{t('words.quizType')}</div>
            <div className="option-group">
              {GRAMMAR_QUIZ_TYPES.map((type) => (
                <button
                  key={type}
                  className={`option-pill ${settings.grammarQuizType === type ? 'active' : ''}`}
                  onClick={() => update({ grammarQuizType: type })}
                >
                  {t(`grammar.quiz.types.${type}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="setup-field">
            <div className="setup-field-label">{t('words.questionCount')}</div>
            <div className="option-group">
              {VOCAB_QUIZ_COUNTS.map((count) => (
                <button
                  key={count}
                  className={`option-pill ${settings.grammarQuizCount === count ? 'active' : ''}`}
                  onClick={() => update({ grammarQuizCount: count })}
                >
                  {count === 0 ? t('words.countAll', { count: quizPoints.length }) : count}
                </button>
              ))}
            </div>
          </div>
          <div className="start-card-actions vocab-start">
            <button className="btn btn-primary btn-lg" onClick={startQuiz} disabled={quizPoints.length === 0}>
              <Play size={18} /> {t('words.start')}
            </button>
          </div>
        </section>
      ) : (
        <section className="vocab-panel animate-in">
          <div className="vocab-search">
            <Search size={16} />
            <input
              className="form-input"
              type="search"
              placeholder={t('grammar.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="vocab-count">
            <span>{t('grammar.count', { count: visible.length })}</span>
            <div className="vocab-count-actions">
              <button className="btn btn-ghost btn-sm vocab-info-button" onClick={() => setShowInfo(true)}>
                <Info size={14} /> {t('kanjiList.info.button')}
              </button>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="empty-state-text">{t('grammar.noMatch', { query })}</p>
          ) : (
            sections.map(({ level, points }) => {
              const expanded = !collapsed.includes(level);
              return (
                <section key={level} className={`vocab-section ${expanded ? 'open' : ''}`} aria-label={level}>
                  <button
                    className={`vocab-section-header ${expanded ? 'open' : ''}`}
                    onClick={() => toggleSection(level)}
                    aria-expanded={expanded}
                  >
                    <ChevronDown size={16} className="vocab-section-chevron" />
                    <span className="vocab-section-title">{level}</span>
                    <span className="vocab-section-count">{t('grammar.count', { count: points.length })}</span>
                  </button>
                  {expanded && (
                    <div className="vocab-list">
                      {points.map((point) => (
                        <GrammarRow key={point.id} point={point} number={point.number} status={reviewStatus(progress[grammarKey(point)])} onOpen={() => open(point.id)} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </section>
      )}
    </div>
  );
}
