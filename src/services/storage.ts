import type { UserSettings, Session, SessionSummary } from '../types';
import { DEFAULT_SETTINGS, EXERCISE_MODES, JLPT_SECTIONS } from '../types';
import { LANGUAGES } from '../i18n';

const KEYS = {
  settings: 'sjp_settings',
  sessions: 'sjp_sessions',
  version: 'sjp_schema_version',
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
