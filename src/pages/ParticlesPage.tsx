import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronDown, Info, ListOrdered, Play, Search, Settings, Shuffle, Sparkles } from 'lucide-react';
import type { UserSettings } from '../types';
import { JLPT_LEVELS, PARTICLE_QUIZ_COUNTS, PARTICLE_QUIZ_SOURCES, hasAISetup } from '../types';
import type { GrammarPoint } from '../services/grammar';
import { matchesGrammarSearch, PARTICLE_POINTS, PARTICLES } from '../services/grammar';
import type { ParticleQuestion } from '../services/particles';
import { buildParticleListQuiz } from '../services/particles';
import { generateParticleQuestions, judgeParticleAnswer } from '../services/particleAI';
import { aiConfigFromSettings } from '../services/ai';
import { GrammarRow } from '../components/GrammarRow';
import GrammarDetailDialog from '../components/GrammarDetailDialog';
import GrammarInfoDialog from '../components/GrammarInfoDialog';
import ParticleQuiz from '../components/ParticleQuiz';
import GeneratingScreen from '../components/GeneratingScreen';
import AnswerTips from '../components/AnswerTips';
import SettingsButton from '../components/SettingsButton';
import { useI18n } from '../i18n';

interface ParticlesPageProps {
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
}

/**
 * The particle list (助詞), its own page from Home (user-requested, apart from the
 * grammar list): one collapsible section per particle with its uses; a row opens the
 * use's card. The Practice tab fills particles into sentences: new ones from the AI,
 * or the list's examples (no AI). The practice always covers every particle.
 */
export default function ParticlesPage({ settings, onSettingsChange }: ParticlesPageProps) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'list' | 'practice'>('list');
  const [query, setQuery] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [practice, setPractice] = useState<ParticleQuestion[] | null>(null);
  // Each practice (also a retry of the wrong sentences) starts with fresh state
  const [practiceNumber, setPracticeNumber] = useState(0);
  const [generating, setGenerating] = useState(false);
  // AI sentences wait on the How to answer screen until Start (user-requested); the list's start at once
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  // A cancelled generation's result is ignored
  const generation = useRef(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [direction, setDirection] = useState<'next' | 'previous' | null>(null);
  const open = (id: string | null, dir: 'next' | 'previous' | null = null) => {
    setSelected(id);
    setDirection(dir);
  };
  const [searchCollapsed, setSearchCollapsed] = useState<string[]>([]);

  const update = (partial: Partial<UserSettings>) => onSettingsChange({ ...settings, ...partial });

  const searching = query.trim() !== '';
  const sections = useMemo(() => {
    const points = searching ? PARTICLE_POINTS.filter((p) => matchesGrammarSearch(p, query)) : PARTICLE_POINTS;
    return PARTICLES.map((particle) => ({ particle, points: points.filter((p) => p.particle === particle) }))
      .filter((s) => s.points.length > 0);
  }, [searching, query]);
  const visibleCount = sections.reduce((n, s) => n + s.points.length, 0);
  const collapsed = searching ? searchCollapsed : settings.particleCollapsed;
  const toggleSection = (particle: string) => {
    const next = collapsed.includes(particle) ? collapsed.filter((p) => p !== particle) : [...collapsed, particle];
    if (searching) setSearchCollapsed(next);
    else update({ particleCollapsed: next });
  };

  // The card steps through the uses of the open sections
  const browsable = useMemo(
    () => sections.filter((s) => !collapsed.includes(s.particle)).flatMap((s) => s.points),
    [sections, collapsed]
  );
  const index = browsable.findIndex((p) => p.id === selected);
  const current: GrammarPoint | undefined = index >= 0 ? browsable[index] : PARTICLE_POINTS.find((p) => p.id === selected);

  // ─── Practice ─────────────────────────────────────────
  const source = settings.particleQuizSource;
  const hasAI = hasAISetup(settings);
  // "All" is only for the list's examples; the AI writes a set number of sentences
  const counts = PARTICLE_QUIZ_COUNTS.filter((c) => source === 'list' || c > 0);
  const count = counts.includes(settings.particleQuizCount) ? settings.particleQuizCount : 10;
  const startPractice = async () => {
    setGenerationError(null);
    if (source === 'list') {
      setPracticeStarted(true);
      setPractice(buildParticleListQuiz(PARTICLE_POINTS, count, lang));
      setPracticeNumber((n) => n + 1);
      return;
    }
    const id = ++generation.current;
    setPracticeStarted(false);
    setGenerating(true);
    try {
      const questions = await generateParticleQuestions(aiConfigFromSettings(settings), settings.particleQuizLevel, lang, count);
      if (id !== generation.current) return;
      setPractice(questions);
      setPracticeNumber((n) => n + 1);
    } catch (err) {
      if (id === generation.current) setGenerationError(err instanceof Error ? err.message : String(err));
    } finally {
      if (id === generation.current) setGenerating(false);
    }
  };
  const cancelGeneration = () => {
    generation.current++;
    setGenerating(false);
  };
  const judge = (question: ParticleQuestion, answers: string[]) =>
    judgeParticleAnswer(aiConfigFromSettings(settings), lang, question, answers);

  // While the AI writes, and until Start: How to answer
  if (generating || (practice && !practiceStarted)) {
    return (
      <GeneratingScreen
        ready={!generating}
        title={t('particles.generatingTitle')}
        text={t('particles.generatingText')}
        tips={<AnswerTips kind="particle" />}
        onBack={() => { cancelGeneration(); setPractice(null); }}
        onStart={() => setPracticeStarted(true)}
      />
    );
  }

  if (practice) {
    return (
      <div className="app-main kanji-quiz-main">
        <ParticleQuiz
          key={practiceNumber}
          questions={practice}
          onRetry={(wrong) => {
            setPractice([...wrong].sort(() => Math.random() - 0.5));
            setPracticeNumber((n) => n + 1);
          }}
          onExit={() => setPractice(null)}
          onJudge={hasAI ? judge : undefined}
          // The How to answer screen already explained the keypad for AI sentences
          showTypeTip={source === 'list'}
          onOpenSettings={() => navigate('/settings', { state: { from: '/particles' } })}
        />
      </div>
    );
  }


  return (
    <div className="app-main">
      {showInfo && <GrammarInfoDialog onClose={() => setShowInfo(false)} />}
      {current && (
        <GrammarDetailDialog
          point={current}
          position={index >= 0 ? { index, total: browsable.length } : undefined}
          direction={direction}
          onPrevious={index > 0 ? () => open(browsable[index - 1].id, 'previous') : undefined}
          onNext={index >= 0 && index < browsable.length - 1 ? () => open(browsable[index + 1].id, 'next') : undefined}
          onClose={() => open(null)}
        />
      )}

      <section className="welcome-section vocab-header animate-in">
        <h1 className="welcome-title">{t('particles.title')}</h1>
        <p className="welcome-subtitle">{t('particles.subtitle')}</p>
      </section>

      <div className="vocab-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'list'} className={`vocab-tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
          <ListOrdered size={16} /> {t('particles.tabList')}
        </button>
        <button role="tab" aria-selected={tab === 'practice'} className={`vocab-tab ${tab === 'practice' ? 'active' : ''}`} onClick={() => setTab('practice')}>
          <Shuffle size={16} /> {t('particles.tabPractice')}
        </button>
      </div>

      {tab === 'practice' ? (
        <section className="start-card vocab-panel animate-in">
          <div className="setup-field">
            <div className="setup-field-label">{t('particles.source')}</div>
            <div className="option-group">
              {PARTICLE_QUIZ_SOURCES.map((s) => (
                <button
                  key={s}
                  className={`option-pill ${source === s ? 'active' : ''}`}
                  onClick={() => update({ particleQuizSource: s })}
                >
                  {s === 'ai' && <Sparkles size={14} />} {t(`particles.sources.${s}`)}
                </button>
              ))}
            </div>
            <p className="setup-field-help">{t(`particles.sourceHelp.${source}`)}</p>
          </div>
          {source === 'ai' && (
            <div className="setup-field">
              <div className="setup-field-label">{t('particles.level')}</div>
              <div className="option-group">
                {JLPT_LEVELS.map((level) => (
                  <button
                    key={level}
                    className={`option-pill ${settings.particleQuizLevel === level ? 'active' : ''}`}
                    onClick={() => update({ particleQuizLevel: level })}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="setup-field">
            <div className="setup-field-label">{t('particles.countLabel')}</div>
            <div className="option-group">
              {counts.map((c) => (
                <button
                  key={c}
                  className={`option-pill ${count === c ? 'active' : ''}`}
                  onClick={() => update({ particleQuizCount: c })}
                >
                  {c === 0 ? t('words.countAll', { count: PARTICLE_POINTS.length }) : c}
                </button>
              ))}
            </div>
          </div>
          {source === 'ai' && !hasAI && (
            <div className="alert alert-warning setup-dialog-alert">
              <AlertCircle size={16} />
              <span style={{ flex: 1 }}>{t('home.apiKeyMissing')}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/settings', { state: { from: '/particles' } })}>
                <Settings size={14} /> {t('header.settings')}
              </button>
            </div>
          )}
          {generationError && (
            <div className="alert alert-error">
              <AlertCircle size={16} />
              <span style={{ flex: 1 }}>{generationError}</span>
              <SettingsButton onClick={() => navigate('/settings', { state: { from: '/particles' } })} />
            </div>
          )}
          <div className="start-card-actions vocab-start">
            <button className="btn btn-primary btn-lg" onClick={startPractice} disabled={source === 'ai' && !hasAI}>
              <Play size={18} /> {t('particles.start')}
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
              placeholder={t('particles.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="vocab-count">
            <span>{t('particles.count', { count: visibleCount })}</span>
            <div className="vocab-count-actions">
              <button className="btn btn-ghost btn-sm vocab-info-button" onClick={() => setShowInfo(true)}>
                <Info size={14} /> {t('kanjiList.info.button')}
              </button>
            </div>
          </div>

          {visibleCount === 0 ? (
            <p className="empty-state-text">{t('particles.noMatch', { query })}</p>
          ) : (
            sections.map(({ particle, points }) => {
              const expanded = !collapsed.includes(particle);
              return (
                <section key={particle} className={`vocab-section ${expanded ? 'open' : ''}`} aria-label={particle}>
                  <button
                    className={`vocab-section-header ${expanded ? 'open' : ''}`}
                    onClick={() => toggleSection(particle)}
                    aria-expanded={expanded}
                  >
                    <ChevronDown size={16} className="vocab-section-chevron" />
                    <span className="vocab-section-title jp-text" lang="ja">{particle}</span>
                    <span className="vocab-section-count">{t('particles.count', { count: points.length })}</span>
                  </button>
                  {expanded && (
                    <div className="vocab-list">
                      {points.map((point, i) => (
                        <GrammarRow key={point.id} point={point} number={i + 1} onOpen={() => open(point.id)} />
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
