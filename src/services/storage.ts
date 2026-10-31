import type { UserSettings, Session, SessionSummary, Attempt, EvaluationResponse } from '../types';
import { DEFAULT_SETTINGS, EXERCISE_MODES, JLPT_SECTIONS, TRANSLATION_FORMATS, STORY_PARAGRAPHS, STORY_TOPICS, STORY_TENSES, KANJI_SESSION_TYPES, VOCAB_CATEGORIES, VOCAB_QUIZ_TYPES, VOCAB_QUIZ_COUNTS, VERB_GROUP_FILTERS, ADJ_TYPE_FILTERS, VOCAB_JLPT_FILTERS, VOCAB_FREQUENCY_FILTERS, VOCAB_FREQUENCIES, VOCAB_JLPT_VALUES, VERB_GROUP_VALUES, ADJ_TYPE_VALUES } from '../types';
import { LANGUAGES } from '../i18n';
import type { KanjiProgressMap } from './kanjiProgress';
import { progressFromSessions } from './kanjiProgress';

const KEYS = {
  settings: 'sjp_settings',
  sessions: 'sjp_sessions',
  version: 'sjp_schema_version',
  active: 'sjp_active_session',
  kanjiProgress: 'sjp_kanji_progress',
} as const;

const CURRENT_SCHEMA_VERSION = 1;

// ─── Helpers ────────────────────────────────────────────

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    console.warn(`[Storage] Failed to save key "${key}"`);
    return false;
  }
}

// ─── Schema Migration ───────────────────────────────────

function ensureSchema(): void {
  const version = safeGet<number>(KEYS.version, 0);
  if (version < CURRENT_SCHEMA_VERSION) {
    safeSet(KEYS.version, CURRENT_SCHEMA_VERSION);
  }
}

// ─── Settings ───────────────────────────────────────────

export function loadSettings(): UserSettings {
  ensureSchema();
  const { examMode, ...stored } = safeGet<Partial<UserSettings> & { examMode?: boolean }>(KEYS.settings, {});
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  // Exam mode was a toggle; it's now the "1 attempt" choice
  if (examMode) settings.maxAttempts = 1;
  // 'japanese-response' was replaced by conversation practice
  if (!EXERCISE_MODES.includes(settings.exerciseMode)) settings.exerciseMode = 'conversation';
  // 'exam' used to be its own mode; it's now the "1 attempt" choice
  if ((settings.appMode as string) === 'exam') {
    settings.appMode = 'practice';
    settings.maxAttempts = 1;
    if (settings.exerciseMode === 'conversation') settings.exerciseMode = 'translation';
  }
  // The grammar section was removed
  if (!JLPT_SECTIONS.includes(settings.jlptSection)) settings.jlptSection = 'kanji';
  // Kanji recognition moved into the JLPT mock test
  if ((settings.appMode as string) === 'kanji') {
    settings.appMode = 'jlpt';
    settings.jlptSection = 'kanji';
  }
  if (!TRANSLATION_FORMATS.includes(settings.translationFormat)) settings.translationFormat = DEFAULT_SETTINGS.translationFormat;
  if (!STORY_PARAGRAPHS.includes(settings.storyParagraphs)) settings.storyParagraphs = DEFAULT_SETTINGS.storyParagraphs;
  if (!STORY_TOPICS.includes(settings.storyTopic)) settings.storyTopic = DEFAULT_SETTINGS.storyTopic;
  if (typeof settings.storyCustomTopic !== 'string') settings.storyCustomTopic = '';
  if (!STORY_TENSES.includes(settings.storyTense)) settings.storyTense = DEFAULT_SETTINGS.storyTense;
  if (!KANJI_SESSION_TYPES.includes(settings.kanjiSessionType)) settings.kanjiSessionType = DEFAULT_SETTINGS.kanjiSessionType;
  if (!VOCAB_CATEGORIES.includes(settings.vocabCategory)) settings.vocabCategory = DEFAULT_SETTINGS.vocabCategory;
  if (!VOCAB_QUIZ_TYPES.includes(settings.vocabQuizType)) settings.vocabQuizType = DEFAULT_SETTINGS.vocabQuizType;
  if (!VOCAB_QUIZ_COUNTS.includes(settings.vocabQuizCount)) settings.vocabQuizCount = DEFAULT_SETTINGS.vocabQuizCount;
  if (!VERB_GROUP_FILTERS.includes(settings.vocabVerbGroup)) settings.vocabVerbGroup = DEFAULT_SETTINGS.vocabVerbGroup;
  if (!ADJ_TYPE_FILTERS.includes(settings.vocabAdjType)) settings.vocabAdjType = DEFAULT_SETTINGS.vocabAdjType;
  if (!VOCAB_JLPT_FILTERS.includes(settings.vocabJlpt)) settings.vocabJlpt = DEFAULT_SETTINGS.vocabJlpt;
  if (!VOCAB_FREQUENCY_FILTERS.includes(settings.vocabFrequency)) settings.vocabFrequency = DEFAULT_SETTINGS.vocabFrequency;
  if (typeof settings.vocabShowDetails !== 'boolean') settings.vocabShowDetails = DEFAULT_SETTINGS.vocabShowDetails;
  // Lists of picked values: keep only the valid ones
  const onlyValid = <T,>(value: unknown, valid: readonly T[]): T[] =>
    Array.isArray(value) ? value.filter((v): v is T => valid.includes(v as T)) : [];
  settings.vocabCollapsed = Array.isArray(settings.vocabCollapsed) ? settings.vocabCollapsed.filter((v) => typeof v === 'string') : [];
  settings.vocabQuizJlpt = onlyValid(settings.vocabQuizJlpt, VOCAB_JLPT_VALUES);
  settings.vocabQuizFrequency = onlyValid(settings.vocabQuizFrequency, VOCAB_FREQUENCIES);
  settings.vocabQuizVerbGroups = onlyValid(settings.vocabQuizVerbGroups, VERB_GROUP_VALUES);
  settings.vocabQuizAdjTypes = onlyValid(settings.vocabQuizAdjTypes, ADJ_TYPE_VALUES);
  // A language that is no longer shipped
  if (!(settings.instructionLanguage in LANGUAGES)) settings.instructionLanguage = DEFAULT_SETTINGS.instructionLanguage;
  return settings;
}

export function saveSettings(settings: UserSettings): boolean {
  // Never persist apiKey if empty — but do persist if set
  const toSave = { ...settings };
  return safeSet(KEYS.settings, toSave);
}

export function clearApiKey(): boolean {
  const settings = loadSettings();
  settings.apiKey = '';
  return saveSettings(settings);
}

// ─── Sessions ───────────────────────────────────────────

export function loadSessions(): Session[] {
  ensureSchema();
  return safeGet<Session[]>(KEYS.sessions, []);
}

export function saveSession(session: Session): boolean {
  const sessions = loadSessions();
  const index = sessions.findIndex((s) => s.sessionId === session.sessionId);
  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.unshift(session);
  }
  return safeSet(KEYS.sessions, sessions);
}

export function deleteSession(sessionId: string): boolean {
  const sessions = loadSessions().filter((s) => s.sessionId !== sessionId);
  return safeSet(KEYS.sessions, sessions);
}

export function clearAllSessions(): boolean {
  return safeSet(KEYS.sessions, []);
}

export function getSessionById(sessionId: string): Session | null {
  return loadSessions().find((s) => s.sessionId === sessionId) ?? null;
}

// ─── Active session (survives a page reload) ────────────

/** The session in progress plus the state of its current question. */
export interface ActiveSession {
  session: Session;
  /** Attempts at the current question so far */
  attempts: Attempt[];
  /** Feedback shown for the current question, if any */
  lastEvaluation: EvaluationResponse | null;
  /** The expected answer is on screen */
  answerShown?: boolean;
  /** The answer was shown at some point for the current question */
  answerRevealed?: boolean;
  /** Hint steps opened for the current question */
  hintsUsed?: number;
}

export function saveActiveSession(active: ActiveSession): boolean {
  return safeSet(KEYS.active, active);
}

export function clearActiveSession(): void {
  try {
    localStorage.removeItem(KEYS.active);
  } catch {
    // ignore
  }
}

/** The saved session in progress, if it was started with the current mode settings. */
export function loadActiveSession(settings: UserSettings): ActiveSession | null {
  const active = safeGet<ActiveSession | null>(KEYS.active, null);
  const sess = active?.session;
  if (!sess || sess.status !== 'in-progress') return null;
  const sameMode = sess.appMode === settings.appMode && (
    settings.appMode === 'jlpt'
      ? sess.jlptSection === settings.jlptSection
      : sess.mode === settings.exerciseMode
  );
  return sameMode ? { ...active, attempts: active.attempts ?? [], lastEvaluation: active.lastEvaluation ?? null } : null;
}

// ─── Kanji progress (across sessions) ───────────────────

/** Progress per kanji. The first time, it is rebuilt from the saved kanji sessions. */
export function loadKanjiProgress(): KanjiProgressMap {
  const saved = safeGet<KanjiProgressMap | null>(KEYS.kanjiProgress, null);
  if (saved && typeof saved === 'object') return saved;
  const rebuilt = progressFromSessions(loadSessions());
  safeSet(KEYS.kanjiProgress, rebuilt);
  return rebuilt;
}

export function saveKanjiProgress(progress: KanjiProgressMap): boolean {
  return safeSet(KEYS.kanjiProgress, progress);
}

// ─── Session Summaries ──────────────────────────────────

export function getSessionSummaries(): SessionSummary[] {
  return loadSessions().map(sessionToSummary);
}

export function sessionToSummary(session: Session): SessionSummary {
  const correctCount = session.results.filter((r) => r.isCorrect).length;
  const answeredCount = session.results.length;
  const durationMs = session.endedAt
    ? session.endedAt - session.startedAt
    : Date.now() - session.startedAt;

  return {
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    status: session.status,
    appMode: session.appMode,
    jlptSection: session.jlptSection,
    examMode: session.examMode,
    mode: session.mode,
    jlptLevel: session.jlptLevel,
    questionCount: session.questionCount,
    story: session.story && { title: session.story.title },
    messageCount: session.conversation?.messages.filter((m) => m.role === 'user').length,
    correctCount,
    accuracy: answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0,
    durationMs,
  };
}

// ─── Aggregated Stats ───────────────────────────────────

export interface LearningStats {
  totalSessions: number;
  totalQuestions: number;
  totalCorrect: number;
  overallAccuracy: number;
  recentSessions: SessionSummary[];
}

export function getLearningStats(): LearningStats {
  const summaries = getSessionSummaries();
  const completed = summaries.filter((s) => s.status === 'completed');
  // Conversations have no questions, so they only count toward the session total
  const graded = completed.filter((s) => s.messageCount === undefined);

  const totalQuestions = graded.reduce((sum, s) => sum + s.questionCount, 0);
  const totalCorrect = graded.reduce((sum, s) => sum + s.correctCount, 0);

  return {
    totalSessions: completed.length,
    totalQuestions,
    totalCorrect,
    overallAccuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    recentSessions: summaries.slice(0, 3),
  };
}
