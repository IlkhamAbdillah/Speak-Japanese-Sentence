import { useMemo, useState } from 'react';
import { BookA, ChevronDown, Eye, EyeOff, Info, Play, Search, Shuffle, SlidersHorizontal } from 'lucide-react';
import type { UserSettings } from '../types';
import {
  ADJ_TYPE_FILTERS,
  ADJ_TYPE_VALUES,
  VERB_GROUP_FILTERS,
  VERB_GROUP_VALUES,
  VOCAB_CATEGORIES,
  VOCAB_FREQUENCIES,
  VOCAB_FREQUENCY_FILTERS,
  VOCAB_JLPT_VALUES,
  VOCAB_QUIZ_COUNTS,
  VOCAB_QUIZ_TYPES,
} from '../types';
import type { VocabEntry, VocabQuestion } from '../services/vocab';
import { ALL_ENTRIES, applyQuizFilters, applyVocabFilters, buildVocabQuiz, entriesOf, matchesSearch } from '../services/vocab';
import VocabRow from '../components/VocabRow';
import VocabQuiz from '../components/VocabQuiz';
import VocabInfoDialog from '../components/VocabInfoDialog';
import { useI18n } from '../i18n';

interface WordsPageProps {
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
}

type Tab = 'list' | 'quiz';

/** The word list (verbs, adjectives, adverbs, conjunctions, onomatopoeia), and a quiz on it that needs no AI. */
export default function WordsPage({ settings, onSettingsChange }: WordsPageProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('list');
  const [query, setQuery] = useState('');
  const [quiz, setQuiz] = useState<VocabQuestion[] | null>(null);
  // Each quiz (also a retry of the wrong words) starts with fresh quiz state
  const [quizNumber, setQuizNumber] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Sections closed while searching (the saved collapsed state is for the normal list)
  const [searchCollapsed, setSearchCollapsed] = useState<string[]>([]);

  const update = (partial: Partial<UserSettings>) => onSettingsChange({ ...settings, ...partial });
  const category = settings.vocabCategory;
  const entries = useMemo(() => entriesOf(category), [category]);
  // The list uses the dropdown filters, the quiz its own multi-select buttons
  const filtered = useMemo(() => applyVocabFilters(entries, settings), [entries, settings]);
  const quizWords = useMemo(() => applyQuizFilters(entries, settings), [entries, settings]);
  // Searching looks through every list (user-requested), without the category or list filters
  const searching = query.trim() !== '';
  const visible = useMemo(
    () => (searching ? ALL_ENTRIES.filter((e) => matchesSearch(e, query)) : filtered),
    [searching, filtered, query]
  );
  // Row numbers are the position in the word's own list
  const numbers = useMemo(() => {
    const result = new Map<string, number>();
    const seen = new Map<string, number>();
    for (const e of ALL_ENTRIES) {
      const n = (seen.get(e.category) ?? 0) + 1;
      seen.set(e.category, n);
      result.set(e.id, n);
    }
    return result;
  }, []);
  // The list is sorted by JLPT level, so each level is a section that can be collapsed
  // (search results: one section per list and level)
  const sections = useMemo(() => {
    const result: { key: string; title: string; entries: VocabEntry[] }[] = [];
    for (const entry of visible) {
      const level = entry.jlpt ?? 'none';
      const key = `${entry.category}:${level}`;
      if (result.at(-1)?.key !== key) {
        const levelTitle = level === 'none' ? t('words.jlptNoneTag') : level;
        result.push({ key, title: searching ? `${t(`words.category.${entry.category}`)} · ${levelTitle}` : levelTitle, entries: [] });
      }
      result.at(-1)!.entries.push(entry);
    }
    return result;
  }, [visible, searching, t]);
  const collapsed = searching ? searchCollapsed : settings.vocabCollapsed;
  const toggleSection = (key: string) => {
    const next = collapsed.includes(key) ? collapsed.filter((k) => k !== key) : [...collapsed, key];
    if (searching) setSearchCollapsed(next);
    else update({ vocabCollapsed: next });
  };

  // Wrong options still come from the whole category
  const startQuiz = (words: VocabEntry[] = quizWords, count = settings.vocabQuizCount) => {
    setQuiz(buildVocabQuiz(words, settings.vocabQuizType, count, entries));
    setQuizNumber((n) => n + 1);
    setTab('quiz');
  };

  if (quiz) {
    return (
      <div className="app-main">
        <VocabQuiz
          key={quizNumber}
          questions={quiz}
          onRetry={(wrong) => startQuiz(wrong, 0)}
          onExit={() => setQuiz(null)}
          showDetails={settings.vocabShowDetails}
        />
      </div>
    );
  }

  const categoryPills = (
    <div className="option-group">
      {VOCAB_CATEGORIES.map((c) => (
        <button
          key={c}
          className={`option-pill ${category === c ? 'active' : ''}`}
          onClick={() => update({ vocabCategory: c })}
        >
          {t(`words.category.${c}`)}
        </button>
      ))}
    </div>
  );

  const filterSelect = <V extends string>(
    label: string,
    value: V,
    options: readonly V[],
    optionLabel: (v: V) => string,
    onChange: (v: V) => void
  ) => (
    <label className="vocab-filter">
      <span className="setup-field-label">{label}</span>
      <select className="form-select" value={value} onChange={(e) => onChange(e.target.value as V)}>
        {options.map((o) => <option key={o} value={o}>{o === 'all' ? t('words.filters.all') : optionLabel(o)}</option>)}
      </select>
    </label>
  );

  // List filters (dropdowns): how common for every list (no JLPT one: each level is a section); the group for verbs, い/な for adjectives
  const filters = (
    <div className="vocab-filters">
      {filterSelect(t('words.filters.frequency'), settings.vocabFrequency, VOCAB_FREQUENCY_FILTERS,
        (f) => t(`words.frequency.${f as Exclude<typeof f, 'all'>}`), (v) => update({ vocabFrequency: v }))}
      {category === 'verb' && filterSelect(t('words.filters.group'), settings.vocabVerbGroup, VERB_GROUP_FILTERS,
        (g) => t('words.verbGroup', { group: g }), (v) => update({ vocabVerbGroup: v }))}
      {category === 'adjective' && filterSelect(t('words.filters.type'), settings.vocabAdjType, ADJ_TYPE_FILTERS,
        (a) => t(a === 'i' ? 'words.adjI' : 'words.adjNa'), (v) => update({ vocabAdjType: v }))}
    </div>
  );

  // Quiz filters: toggle buttons, several can be on (N5 + N4, very common + common)
  const toggle = <V extends string>(values: readonly V[], value: V): V[] =>
    values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
  const pickRow = <V extends string>(
    label: string,
    options: readonly V[],
    picked: readonly V[],
    optionLabel: (v: V) => string,
    onChange: (values: V[]) => void
  ) => (
    <div className="vocab-pick">
      <div className="setup-field-label">{label}</div>
      <div className="option-group">
        {options.map((o) => (
          <button
            key={o}
            className={`option-pill ${picked.includes(o) ? 'active' : ''}`}
            aria-pressed={picked.includes(o)}
            onClick={() => onChange(toggle(picked, o))}
          >
            {optionLabel(o)}
          </button>
        ))}
      </div>
    </div>
  );
  // Shown by default: JLPT; how common, the verb group and い/な are under Advanced settings (user-requested)
  const jlptPicks = (
    <div className="vocab-picks">
      {pickRow(t('words.filters.jlpt'), VOCAB_JLPT_VALUES, settings.vocabQuizJlpt,
        (l) => (l === 'none' ? t('words.jlptNoneTag') : l), (v) => update({ vocabQuizJlpt: v }))}
      <p className="setup-field-help">{t('words.quizFilterHelp')}</p>
    </div>
  );
  const advancedActive = settings.vocabQuizFrequency.length +
    (category === 'verb' ? settings.vocabQuizVerbGroups.length : 0) +
    (category === 'adjective' ? settings.vocabQuizAdjTypes.length : 0);
  const advancedPicks = (
    <div className="vocab-picks vocab-advanced-body">
      {pickRow(t('words.filters.frequency'), VOCAB_FREQUENCIES, settings.vocabQuizFrequency,
        (f) => t(`words.frequency.${f}`), (v) => update({ vocabQuizFrequency: v }))}
      {category === 'verb' && pickRow(t('words.filters.group'), VERB_GROUP_VALUES, settings.vocabQuizVerbGroups,
        (g) => t('words.verbGroup', { group: g }), (v) => update({ vocabQuizVerbGroups: v }))}
      {category === 'adjective' && pickRow(t('words.filters.type'), ADJ_TYPE_VALUES, settings.vocabQuizAdjTypes,
        (a) => t(a === 'i' ? 'words.adjI' : 'words.adjNa'), (v) => update({ vocabQuizAdjTypes: v }))}
    </div>
  );

  return (
    <div className="app-main">
      {showInfo && <VocabInfoDialog onClose={() => setShowInfo(false)} />}
      <section className="welcome-section vocab-header animate-in">
        <h1 className="welcome-title">{t('words.title')}</h1>
        <p className="welcome-subtitle">{t('words.subtitle')}</p>
      </section>

      <div className="vocab-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'list'} className={`vocab-tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
          <BookA size={16} /> {t('words.tabList')}
        </button>
        <button role="tab" aria-selected={tab === 'quiz'} className={`vocab-tab ${tab === 'quiz' ? 'active' : ''}`} onClick={() => setTab('quiz')}>
          <Shuffle size={16} /> {t('words.tabQuiz')}
        </button>
      </div>

      {tab === 'list' ? (
        <section className="vocab-panel animate-in">
          <div className="vocab-search">
            <Search size={16} />
            <input
              className="form-input"
              type="search"
              placeholder={t('words.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {searching ? (
            <p className="vocab-search-note">{t('words.searchAll')}</p>
          ) : (
            <>
              {categoryPills}
              {filters}
            </>
          )}
          <div className="vocab-count">
            <span>{t('words.count', { count: visible.length })}</span>
            <div className="vocab-count-actions">
              <button
                className="btn btn-ghost btn-sm vocab-info-button"
                onClick={() => update({ vocabShowDetails: !settings.vocabShowDetails })}
                aria-pressed={!settings.vocabShowDetails}
              >
                {settings.vocabShowDetails ? <EyeOff size={14} /> : <Eye size={14} />}
                {settings.vocabShowDetails ? t('words.hideDetails') : t('words.showDetails')}
              </button>
              <button className="btn btn-ghost btn-sm vocab-info-button" onClick={() => setShowInfo(true)}>
                <Info size={14} /> {t('words.info.button')}
              </button>
            </div>
          </div>
          {visible.length === 0 ? (
            <p className="empty-state-text">{query.trim() ? t('words.noMatch', { query }) : t('words.noFilterMatch')}</p>
          ) : (
            sections.map((section) => {
              const open = !collapsed.includes(section.key);
              return (
                <section key={section.key} className={`vocab-section ${open ? 'open' : ''}`} aria-label={section.title}>
                  <button
                    className={`vocab-section-header ${open ? 'open' : ''}`}
                    onClick={() => toggleSection(section.key)}
                    aria-expanded={open}
                  >
                    <ChevronDown size={16} className="vocab-section-chevron" />
                    <span className="vocab-section-title">{section.title}</span>
                    <span className="vocab-section-count">{t('words.count', { count: section.entries.length })}</span>
                  </button>
                  {open && (
                    <div className="vocab-list">
                      {section.entries.map((entry) => (
                        <VocabRow
                          key={entry.id}
                          entry={entry}
                          number={numbers.get(entry.id) ?? 0}
                          showDetails={settings.vocabShowDetails}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </section>
      ) : (
        <section className="start-card vocab-panel animate-in">
          <div className="setup-field">
            <div className="setup-field-label">{t('words.categoryLabel')}</div>
            {categoryPills}
            {jlptPicks}
          </div>
          <div className="setup-field">
            <div className="setup-field-label">{t('words.quizType')}</div>
            <div className="option-group">
              {VOCAB_QUIZ_TYPES.map((type) => (
                <button
                  key={type}
                  className={`option-pill ${settings.vocabQuizType === type ? 'active' : ''}`}
                  onClick={() => update({ vocabQuizType: type })}
                >
                  {t(`words.quizTypes.${type}`)}
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
                  className={`option-pill ${settings.vocabQuizCount === count ? 'active' : ''}`}
                  onClick={() => update({ vocabQuizCount: count })}
                >
                  {count === 0 ? t('words.countAll', { count: quizWords.length }) : count}
                </button>
              ))}
            </div>
          </div>
          <div className="vocab-advanced">
            <button
              className="btn btn-ghost btn-sm vocab-advanced-toggle"
              onClick={() => setShowAdvanced((open) => !open)}
              aria-expanded={showAdvanced}
            >
              <SlidersHorizontal size={14} />
              {t('words.advanced')}
              {advancedActive > 0 && <span className="badge badge-accent">{advancedActive}</span>}
              <ChevronDown size={14} className={`vocab-advanced-chevron ${showAdvanced ? 'open' : ''}`} />
            </button>
            {showAdvanced && advancedPicks}
          </div>
          {quizWords.length === 0 && <p className="setup-field-help setup-field-note">{t('words.noFilterMatch')}</p>}
          <div className="start-card-actions vocab-start">
            <button className="btn btn-primary btn-lg" onClick={() => startQuiz()} disabled={quizWords.length === 0}>
              <Play size={18} /> {t('words.start')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
