import { translate } from '../i18n';
import type { InstructionLanguage } from '../i18n';

// ─── App Modes ──────────────────────────────────────────
// practice: translation / situation / conversation practice
// jlpt:     JLPT mock test — kanji reading or reading comprehension
// Practice (except conversation) and the kanji section can be limited to one
// attempt per question (maxAttempts = 1); reading is always one attempt.
export type AppMode = 'practice' | 'jlpt';

/** Older sessions may carry modes that no longer exist. */
export type StoredAppMode = AppMode | 'exam' | 'kanji';

export const APP_MODES: AppMode[] = ['practice', 'jlpt'];

// ─── JLPT Mock Test Sections ────────────────────────────
export type JLPTSection = 'kanji' | 'reading';

export const JLPT_SECTIONS: JLPTSection[] = ['kanji', 'reading'];

/** Reading tests always have one passage with this many questions. */
export const READING_QUESTION_COUNT = 3;

// ─── Exercise Modes (Practice types) ────────────────────
export type ExerciseMode = 'translation' | 'situation' | 'conversation';

export const EXERCISE_MODES: ExerciseMode[] = ['translation', 'situation', 'conversation'];

// Labels and descriptions for all of the above live in src/i18n/locales/*.json

/** Label for a session, tolerating sessions saved before modes changed. */
export function getSessionModeLabel(
  session: { appMode?: StoredAppMode; jlptSection?: JLPTSection; examMode?: boolean; mode: string },
  lang: InstructionLanguage
): string {
  // Sessions saved when "exam" was its own mode
  if (session.appMode === 'exam') return translate(lang, 'modes.exam');

  const jlptSection = session.appMode === 'kanji' ? 'kanji' : session.jlptSection;
  const base = jlptSection
    ? `JLPT · ${translate(lang, `modes.jlptSection.${jlptSection}.label`)}`
    : (EXERCISE_MODES as string[]).includes(session.mode)
      ? translate(lang, `modes.exercise.${session.mode as ExerciseMode}.label`)
      : translate(lang, 'modes.legacyJapaneseResponse');
  // Older sessions had a separate exam mode
  return session.examMode ? `${base} · ${translate(lang, 'modes.exam')}` : base;
}

type ModeSettings = Pick<UserSettings, 'appMode' | 'exerciseMode' | 'jlptSection' | 'maxAttempts'>;

export function isConversationMode(settings: Pick<ModeSettings, 'appMode' | 'exerciseMode'>): boolean {
  return settings.appMode === 'practice' && settings.exerciseMode === 'conversation';
}

export function isKanjiMode(settings: Pick<ModeSettings, 'appMode' | 'jlptSection'>): boolean {
  return settings.appMode === 'jlpt' && settings.jlptSection === 'kanji';
}

/** Reading is answered by picking one of four choices. */
export function isMultipleChoiceMode(settings: Pick<ModeSettings, 'appMode' | 'jlptSection'>): boolean {
  return settings.appMode === 'jlpt' && settings.jlptSection === 'reading';
}

/** Whether the attempts-per-question choice applies: not to conversation, and multiple choice is always one attempt. */
export function hasAttemptChoice(settings: Omit<ModeSettings, 'maxAttempts'>): boolean {
  return !isConversationMode(settings) && !isMultipleChoiceMode(settings);
}

/**
 * One attempt per question (the user picked 1): nothing to retry, so the
 * explanation is shown right away and the AI gives no hint.
 */
export function isSingleAttemptMode(settings: ModeSettings): boolean {
  return settings.maxAttempts === 1 && hasAttemptChoice(settings);
}

// ─── JLPT Levels ────────────────────────────────────────
export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export const JLPT_LEVELS: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

// ─── Instruction Language ───────────────────────────────
// The languages themselves are defined in src/i18n
export type { InstructionLanguage };

// ─── Question ───────────────────────────────────────────
export type QuestionMode = 'translation' | 'situation' | 'kanji' | 'reading';

export interface Question {
  questionId: string;
  mode: QuestionMode;
  jlptLevel: JLPTLevel;
  instructionLanguage: InstructionLanguage;
  prompt: string;
  context?: string;
  intendedMeaning: string;
  expectedAnswer: string;
  acceptableAnswerGuidelines: string;
  /** Other correct answers (kanji mode: other valid readings in hiragana) */
  alternativeAnswers?: string[];
  /** Other spellings with the same sound, accepted because speech recognition may produce them (kanji mode) */
  acceptedSpellings?: string[];
  /** Example usage (kanji mode) */
  example?: { japanese: string; translation: string };
  /** Multiple choice (reading): the four options and the index of the right one */
  choices?: string[];
  correctChoice?: number;
  /** Why the right choice is right, in the instruction language (reading) */
  explanation?: string;
  /** The text the question is about (reading); shared by every question of the test */
  passage?: string;
  relevantVocabulary: string[];
  relevantGrammar: string[];
}

// ─── Attempt ────────────────────────────────────────────
export interface Attempt {
  attemptNumber: number;
  transcript: string;
  isCorrect: boolean;
  feedback: string;
  grammarNotes: string[];
  vocabularyNotes: string[];
  hint: string | null;
  responseTimeMs: number;
  timestamp: number;
  wasManuallyEdited?: boolean;
}

// ─── Question Result ────────────────────────────────────
export interface QuestionResult {
  question: Question;
  attempts: Attempt[];
  isCorrect: boolean;
  totalTimeMs: number;
  finalTranscript: string;
  revealedAnswer: boolean;
}

// ─── Session ────────────────────────────────────────────
export type SessionStatus = 'in-progress' | 'completed' | 'abandoned';

// ─── Conversation ───────────────────────────────────────
export interface ConversationCorrection {
  corrected: string;
  explanation: string;
}

export interface ConversationMessage {
  id: string;
  role: 'ai' | 'user';
  text: string;
  /** Translation into the instruction language (AI messages only) */
  translation?: string;
  /** Correction of the user's message, if it had mistakes (user messages only) */
  correction?: ConversationCorrection | null;
  timestamp: number;
}

export interface ConversationData {
  /** User-provided topic/context, or null when the AI picked a random topic */
  topic: string | null;
  messages: ConversationMessage[];
}

export interface Session {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  status: SessionStatus;
  /** Missing on sessions saved before app modes existed (treated as 'practice'); 'exam' on older exam sessions */
  appMode?: StoredAppMode;
  jlptSection?: JLPTSection;
  /** Set on sessions from when exam mode was a separate toggle */
  examMode?: boolean;
  mode: ExerciseMode;
  jlptLevel: JLPTLevel;
  instructionLanguage: InstructionLanguage;
  questionCount: number;
  questions: Question[];
  results: QuestionResult[];
  currentQuestionIndex: number;
  conversation?: ConversationData;
}

// ─── Session Summary (for history) ──────────────────────
export interface SessionSummary {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  status: SessionStatus;
  appMode?: StoredAppMode;
  jlptSection?: JLPTSection;
  examMode?: boolean;
  mode: ExerciseMode;
  jlptLevel: JLPTLevel;
  questionCount: number;
  /** Number of messages the user sent (conversation sessions only) */
  messageCount?: number;
  correctCount: number;
  accuracy: number;
  durationMs: number;
}

// ─── AI Provider ────────────────────────────────────────
export type AIProvider = 'openai' | 'google' | 'anthropic' | 'ollama';

export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  // Any OpenAI-compatible URL (Ollama, tunnels…); shown translated as settings.ollamaUrl
  ollama: 'Custom URL',
  openai: 'OpenAI',
  google: 'Google Gemini',
  anthropic: 'Anthropic Claude',
};

export const AI_PROVIDER_MODELS: Record<AIProvider, string[]> = {
  ollama: ['llama3.1', 'llama3.2', 'gemma2', 'mistral', 'qwen2.5', 'phi3', 'deepseek-r1'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano'],
  google: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'],
};

// ─── User Settings ──────────────────────────────────────
export interface UserSettings {
  aiProvider: AIProvider;
  aiModel: string;
  apiKey: string;
  ollamaBaseUrl?: string;
  appMode: AppMode;
  exerciseMode: ExerciseMode;
  jlptSection: JLPTSection;
  jlptLevel: JLPTLevel;
  instructionLanguage: InstructionLanguage;
  questionCount: number;
  /** 1 = a single attempt with the explanation shown right away (see isSingleAttemptMode) */
  maxAttempts: number;
  hintsEnabled: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  aiProvider: 'google',
  aiModel: 'gemini-2.5-flash',
  apiKey: '',
  ollamaBaseUrl: 'http://localhost:11434/v1',
  appMode: 'practice',
  exerciseMode: 'translation',
  jlptSection: 'kanji',
  jlptLevel: 'N5',
  instructionLanguage: 'en',
  questionCount: 5,
  maxAttempts: 3,
  hintsEnabled: true,
};

// ─── AI Evaluation Response ─────────────────────────────
export interface EvaluationResponse {
  correct: boolean;
  transcript: string;
  feedback: string;
  grammarNotes: string[];
  vocabularyNotes: string[];
  hint: string | null;
  nextAction: 'next_question' | 'retry' | 'reveal_answer';
}

// ─── Speech Recognition State ───────────────────────────
export type SpeechState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'evaluating'
  | 'correct'
  | 'retry'
  | 'error'
  | 'unsupported';

// ─── Microphone Permission ──────────────────────────────
export type MicPermission =
  | 'not-requested'
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'error';
