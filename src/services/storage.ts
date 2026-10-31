import type { UserSettings, Session, Attempt, EvaluationResponse } from '../types';
import { DEFAULT_SETTINGS, EXERCISE_MODES, JLPT_SECTIONS, TRANSLATION_FORMATS, STORY_PARAGRAPHS, STORY_TOPICS, STORY_TENSES, KANJI_SESSION_TYPES, VOCAB_CATEGORIES, VOCAB_QUIZ_TYPES, VOCAB_QUIZ_COUNTS, VERB_GROUP_FILTERS, ADJ_TYPE_FILTERS, VOCAB_FREQUENCY_FILTERS, VOCAB_FREQUENCIES, VOCAB_JLPT_VALUES, VERB_GROUP_VALUES, ADJ_TYPE_VALUES, KANJI_STATUS_FILTERS, KANJI_STATUS_VALUES, KANJI_QUIZ_TYPES, JLPT_LEVELS } from '../types';
import { LANGUAGES } from '../i18n';
import type { KanjiProgressMap } from './kanjiProgress';
import { progressFromSessions } from './kanjiProgress';

const KEYS = {
  settings: 'sjp_settings',
  sessions: 'sjp_sessions',
  version: 'sjp_schema_version',
  active: 'sjp_active_session',
  kanjiProgress: 'sjp_kanji_progress',
  dismissedMistakes: 'sjp_dismissed_mistakes',
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
  // The list's JLPT dropdown was removed (the list has a section per level)
  delete (settings as { vocabJlpt?: unknown }).vocabJlpt;
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
  if (!KANJI_STATUS_FILTERS.includes(settings.kanjiStatusFilter)) settings.kanjiStatusFilter = DEFAULT_SETTINGS.kanjiStatusFilter;
  settings.kanjiCollapsed = onlyValid(settings.kanjiCollapsed, JLPT_LEVELS);
  // The radical filter became a parts filter (a kanji counts under every part it contains)
  delete (settings as { kanjiRadical?: unknown }).kanjiRadical;
  if (typeof settings.kanjiPart !== 'string' || [...settings.kanjiPart].length > 1) settings.kanjiPart = '';
  if (!KANJI_QUIZ_TYPES.includes(settings.kanjiQuizType)) settings.kanjiQuizType = DEFAULT_SETTINGS.kanjiQuizType;
  if (!VOCAB_QUIZ_COUNTS.includes(settings.kanjiQuizCount)) settings.kanjiQuizCount = DEFAULT_SETTINGS.kanjiQuizCount;
  settings.kanjiQuizJlpt = Array.isArray(settings.kanjiQuizJlpt) ? onlyValid(settings.kanjiQuizJlpt, JLPT_LEVELS) : DEFAULT_SETTINGS.kanjiQuizJlpt;
  settings.kanjiQuizStatus = onlyValid(settings.kanjiQuizStatus, KANJI_STATUS_VALUES);
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
  // Newest first. When the browser's storage is full, the oldest sessions are dropped
  // (a few at a time) so the new one can still be saved.
  while (!safeSet(KEYS.sessions, sessions)) {
    if (sessions.length <= 1) return false;
    sessions.splice(Math.max(1, Math.floor(sessions.length * 0.9)));
  }
  return true;
}

export function deleteSession(sessionId: string): boolean {
  const sessions = loadSessions().filter((s) => s.sessionId !== sessionId);
  return safeSet(KEYS.sessions, sessions);
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

// ─── Mistakes removed from the Mistakes page ───────────

/** Keys of mistakes the learner removed (see services/mistakes.ts). */
export function loadDismissedMistakes(): Set<string> {
  const saved = safeGet<unknown>(KEYS.dismissedMistakes, []);
  return new Set(Array.isArray(saved) ? saved.map(String) : []);
}

export function saveDismissedMistakes(keys: Set<string>): boolean {
  return safeSet(KEYS.dismissedMistakes, [...keys]);
}
