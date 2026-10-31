import { useMemo, useState } from 'react';
import { ChevronDown, Grid3x3, Info, Play, Search, Shuffle, SlidersHorizontal } from 'lucide-react';
import type { JLPTLevel, UserSettings } from '../types';
import { JLPT_LEVELS, KANJI_QUIZ_TYPES, KANJI_STATUS_FILTERS, KANJI_STATUS_VALUES, VOCAB_QUIZ_COUNTS } from '../types';
import type { KanjiEntry } from '../services/kanjiList';
import { containsPart, KANJI_LIST, matchesKanjiSearch } from '../services/kanjiList';
import { kanjiStatus } from '../services/kanjiProgress';
import { loadKanjiProgress } from '../services/storage';
import KanjiDetailDialog from '../components/KanjiDetailDialog';
import KanjiInfoDialog from '../components/KanjiInfoDialog';
import KanjiQuiz from '../components/KanjiQuiz';
import RadicalPicker from '../components/RadicalPicker';
import type { KanjiQuestion } from '../services/kanjiQuiz';
import { applyKanjiQuizFilters, buildKanjiQuiz } from '../services/kanjiQuiz';
import { useI18n } from '../i18n';

interface KanjiPageProps {
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
}

/**
 * The kanji chart: every JLPT kanji as a tile, one collapsible section per level
 * (teaching order), coloured by the learner's progress from the kanji section.
 * A tile opens the kanji's readings, meanings and words. The Quiz tab tests them
 * (no AI, like the Words quiz).
 */
export default function KanjiPage({ settings, onSettingsChange }: KanjiPageProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'list' | 'quiz'>('list');
  const [quiz, setQuiz] = useState<KanjiQuestion[] | null>(null);
  // Each quiz (also a retry of the wrong kanji) starts with fresh quiz state
  const [quizNumber, setQuizNumber] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [query, setQuery] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  // Which way the detail card last moved (for its slide); null when just opened
  const [direction, setDirection] = useState<'next' | 'previous' | null>(null);
  const [showWords, setShowWords] = useState(false);
  const open = (kanji: string | null, dir: 'next' | 'previous' | null = null) => {
    setSelected(kanji);
    setDirection(dir);
  };
  // Sections closed while searching (the saved collapsed state is for the normal list)
  const [searchCollapsed, setSearchCollapsed] = useState<JLPTLevel[]>([]);
  // Read once: nothing on this page changes the progress
  const progress = useMemo(() => loadKanjiProgress(), []);

  const update = (partial: Partial<UserSettings>) => onSettingsChange({ ...settings, ...partial });
  const statusOf = (entry: KanjiEntry) => kanjiStatus(progress[entry.kanji]);
  // The radical (part) dropdown narrows the list first; the status pills count within it.
  // A kanji counts under every part it contains (聞: 耳 and 門), user-requested.
  const part = settings.kanjiPart;
  const byRadical = useMemo(
    () => (part ? KANJI_LIST.filter((e) => containsPart(e, part)) : KANJI_LIST),
    [part]
  );
  const statusCounts = useMemo(() => {
    const counts = { all: byRadical.length, new: 0, learning: 0, known: 0 };
    for (const e of byRadical) counts[kanjiStatus(progress[e.kanji])]++;
    return counts;
  }, [byRadical, progress]);

  // Searching looks through every kanji, whatever the radical and status filters (like the Words page)
  const searching = query.trim() !== '';
  const filter = settings.kanjiStatusFilter;
  const visible = useMemo(
    () => (searching ? KANJI_LIST : byRadical).filter((e) =>
      searching ? matchesKanjiSearch(e, query) : filter === 'all' || kanjiStatus(progress[e.kanji]) === filter),
    [searching, query, filter, progress, byRadical]
  );
  const sections = useMemo(
    () => JLPT_LEVELS.map((level) => ({ level, entries: visible.filter((e) => e.level === level) }))
      .filter((s) => s.entries.length > 0),
    [visible]
  );
  const collapsed = searching ? searchCollapsed : settings.kanjiCollapsed;
  const toggleSection = (level: JLPTLevel) => {
    const next = collapsed.includes(level) ? collapsed.filter((l) => l !== level) : [...collapsed, level];
    if (searching) setSearchCollapsed(next);
    else update({ kanjiCollapsed: next });
  };

  // The detail dialog steps through the kanji of the open sections
  const browsable = useMemo(
    () => sections.filter((s) => !collapsed.includes(s.level)).flatMap((s) => s.entries),
    [sections, collapsed]
  );
  const index = browsable.findIndex((e) => e.kanji === selected);
  const current = index >= 0 ? browsable[index] : KANJI_LIST.find((e) => e.kanji === selected);

  // ─── Quiz ─────────────────────────────────────────────
  const quizKanji = useMemo(
    () => applyKanjiQuizFilters(settings, progress),
    [settings, progress]
  );
  const startQuiz = (entries: KanjiEntry[] = quizKanji, count = settings.kanjiQuizCount) => {
    setQuiz(buildKanjiQuiz(entries, settings.kanjiQuizType, count));
    setQuizNumber((n) => n + 1);
  };
  if (quiz) {
    return (
      <div className="app-main kanji-quiz-main">
        <KanjiQuiz key={quizNumber} questions={quiz} onRetry={(wrong) => startQuiz(wrong, 0)} onExit={() => setQuiz(null)} />
      </div>
    );
  }
  const toggle = <V extends string>(values: readonly V[], value: V): V[] =>
    values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

  return (
    <div className="app-main">
      {showInfo && <KanjiInfoDialog onClose={() => setShowInfo(false)} />}
      {current && (
        <KanjiDetailDialog
          entry={current}
          progress={progress[current.kanji]}
          direction={direction}
          showWords={showWords}
          onShowWordsChange={setShowWords}
          onPrevious={index > 0 ? () => open(browsable[index - 1].kanji, 'previous') : undefined}
          onNext={index >= 0 && index < browsable.length - 1 ? () => open(browsable[index + 1].kanji, 'next') : undefined}
          onClose={() => open(null)}
        />
      )}

      <section className="welcome-section vocab-header animate-in">
        <h1 className="welcome-title">{t('kanjiList.title')}</h1>
        <p className="welcome-subtitle">{t('kanjiList.subtitle')}</p>
      </section>

      <div className="vocab-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'list'} className={`vocab-tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
          <Grid3x3 size={16} /> {t('kanjiList.quiz.tabList')}
        </button>
        <button role="tab" aria-selected={tab === 'quiz'} className={`vocab-tab ${tab === 'quiz' ? 'active' : ''}`} onClick={() => setTab('quiz')}>
          <Shuffle size={16} /> {t('kanjiList.quiz.tabQuiz')}
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
                  className={`option-pill ${settings.kanjiQuizJlpt.includes(level) ? 'active' : ''}`}
                  aria-pressed={settings.kanjiQuizJlpt.includes(level)}
                  onClick={() => update({ kanjiQuizJlpt: toggle(settings.kanjiQuizJlpt, level) })}
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
              {KANJI_QUIZ_TYPES.map((type) => (
                <button
                  key={type}
                  className={`option-pill ${settings.kanjiQuizType === type ? 'active' : ''}`}
                  onClick={() => update({ kanjiQuizType: type })}
                >
                  {t(`kanjiList.quiz.types.${type}`)}
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
                  className={`option-pill ${settings.kanjiQuizCount === count ? 'active' : ''}`}
                  onClick={() => update({ kanjiQuizCount: count })}
                >
                  {count === 0 ? t('words.countAll', { count: quizKanji.length }) : count}
                </button>
              ))}
            </div>
          </div>
          <div className="vocab-advanced">
            <button
              className="btn btn-ghost btn-sm vocab-advanced-toggle"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
            >
              <SlidersHorizontal size={14} />
              {t('words.advanced')}
              {settings.kanjiQuizStatus.length > 0 && <span className="badge badge-accent">{settings.kanjiQuizStatus.length}</span>}
              <ChevronDown size={14} className={`vocab-advanced-chevron ${showAdvanced ? 'open' : ''}`} />
            </button>
            {showAdvanced && (
              <div className="vocab-picks vocab-advanced-body">
                <div className="vocab-pick">
                  <div className="setup-field-label">{t('kanjiList.quiz.status')}</div>
                  <div className="option-group">
                    {KANJI_STATUS_VALUES.map((st) => (
                      <button
                        key={st}
                        className={`option-pill ${settings.kanjiQuizStatus.includes(st) ? 'active' : ''}`}
                        aria-pressed={settings.kanjiQuizStatus.includes(st)}
                        onClick={() => update({ kanjiQuizStatus: toggle(settings.kanjiQuizStatus, st) })}
                      >
                        <span className={`kanji-status-dot kanji-status-${st}`} />
                        {t(`kanjiList.status.${st}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          {quizKanji.length === 0 && <p className="setup-field-help setup-field-note">{t('kanjiList.quiz.noFilterMatch')}</p>}
          <p className="setup-field-help">{t('kanjiList.quiz.notSaved')}</p>
          <div className="start-card-actions vocab-start">
            <button className="btn btn-primary btn-lg" onClick={() => startQuiz()} disabled={quizKanji.length === 0}>
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
              placeholder={t('kanjiList.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {searching ? (
            <p className="vocab-search-note">{t('kanjiList.searchAll')}</p>
          ) : (
            <>
              <div className="vocab-filters">
                <div className="vocab-filter kanji-radical-filter">
                  <span className="setup-field-label">{t('kanjiList.radical')}</span>
                  <RadicalPicker value={part} onChange={(id) => update({ kanjiPart: id })} />
                </div>
              </div>
              <div className="option-group">
                {KANJI_STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    className={`option-pill ${filter === s ? 'active' : ''}`}
                    onClick={() => update({ kanjiStatusFilter: s })}
                  >
                    {s !== 'all' && <span className={`kanji-status-dot kanji-status-${s}`} />}
                    {t('kanjiList.statusCount', { label: t(`kanjiList.status.${s}`), count: statusCounts[s] })}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="vocab-count">
            <span>{t('kanjiList.count', { count: visible.length })}</span>
            <div className="vocab-count-actions">
              <button className="btn btn-ghost btn-sm vocab-info-button" onClick={() => setShowInfo(true)}>
                <Info size={14} /> {t('kanjiList.info.button')}
              </button>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="empty-state-text">{searching ? t('kanjiList.noMatch', { query }) : t('kanjiList.noFilterMatch')}</p>
          ) : (
            sections.map(({ level, entries }) => {
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
                    <span className="vocab-section-count">{t('kanjiList.count', { count: entries.length })}</span>
                  </button>
                  {expanded && (
                    <div className="kanji-grid">
                      {entries.map((entry, i) => (
                        <KanjiTileWithUnit
                          key={entry.kanji}
                          entry={entry}
                          // A textbook level is split by unit
                          unitLabel={entry.unit && entry.unit !== entries[i - 1]?.unit ? t('kanjiList.unit', { unit: entry.unit }) : undefined}
                          status={statusOf(entry)}
                          onOpen={() => open(entry.kanji)}
                        />
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

interface KanjiTileProps {
  entry: KanjiEntry;
  unitLabel?: string;
  status: ReturnType<typeof kanjiStatus>;
  onOpen: () => void;
}

function KanjiTileWithUnit({ entry, unitLabel, status, onOpen }: KanjiTileProps) {
  const { t } = useI18n();
  return (
    <>
      {unitLabel && <div className="kanji-unit-label">{unitLabel}</div>}
      <button
        className={`kanji-tile kanji-status-${status}`}
        onClick={onOpen}
        title={`${entry.kanji} · ${entry.meanings.join(', ')} · ${t(`kanjiList.status.${status}`)}`}
      >
        <span className="kanji-tile-glyph jp-text" lang="ja">{entry.kanji}</span>
        <span className="kanji-tile-meaning">{entry.meanings[0] ?? ''}</span>
      </button>
    </>
  );
}
