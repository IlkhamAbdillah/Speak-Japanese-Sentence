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

/**
 * Kanji sessions: new = kanji not practised yet come first;
 * review = kanji already practised, the ones due for review first.
 */
export type KanjiSessionType = 'new' | 'review';

export const KANJI_SESSION_TYPES: KanjiSessionType[] = ['new', 'review'];

/** Reading tests always have one passage with this many questions. */
export const READING_QUESTION_COUNT = 3;

// ─── Exercise Modes (Practice types) ────────────────────
export type ExerciseMode = 'translation' | 'situation' | 'conversation';

export const EXERCISE_MODES: ExerciseMode[] = ['translation', 'situation', 'conversation'];

// ─── Translation format ─────────────────────────────────
// story:     one coherent story, translated one sentence at a time
// sentences: unrelated sentences (quick practice)
export type TranslationFormat = 'story' | 'sentences';

export const TRANSLATION_FORMATS: TranslationFormat[] = ['story', 'sentences'];

/** Story length choices, in paragraphs */
export const STORY_PARAGRAPHS = [1, 2, 3, 5];

export type StoryTopic =
  | 'random'
  | 'dailyLife'
  | 'university'
  | 'shopping'
  | 'travel'
  | 'food'
  | 'hobbies'
  | 'work'
  | 'friends'
  /** The learner's own topic, in `storyCustomTopic` */
  | 'custom';

export const STORY_TOPICS: StoryTopic[] = [
  'random', 'dailyLife', 'university', 'shopping', 'travel', 'food', 'hobbies', 'work', 'friends', 'custom',
];

export const STORY_CUSTOM_TOPIC_MAX_LENGTH = 150;

/** When the story takes place; random picks one of the others */
export type StoryTense = 'random' | 'past' | 'present' | 'future';

export const STORY_TENSES: StoryTense[] = ['random', 'past', 'present', 'future'];

// Labels and descriptions for all of the above live in src/i18n/locales/*.json

/** Label for a session, tolerating sessions saved before modes changed. */
export function getSessionModeLabel(
  session: { appMode?: StoredAppMode; jlptSection?: JLPTSection; examMode?: boolean; mode: string; story?: { title: string } },
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
  if (session.story) return `${base} · ${translate(lang, 'setup.formatStory')}`;
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

/** Translation practice with a story instead of unrelated sentences. */
export function isStoryMode(settings: Pick<UserSettings, 'appMode' | 'exerciseMode' | 'translationFormat'>): boolean {
  return settings.appMode === 'practice' && settings.exerciseMode === 'translation' && settings.translationFormat === 'story';
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
  /** The kanji this question teaches (kanji mode); the word may contain other, easier kanji */
  targetKanji?: string;
  /** Position in the story (story translation), both 0-based */
  paragraphIndex?: number;
  sentenceIndex?: number;
}

// ─── Story (story translation) ──────────────────────────
export interface StorySentence {
  /** The sentence in the instruction language */
  source: string;
  /** Reference Japanese translation */
  expectedAnswer: string;
}

/**
 * The whole story, kept on the session so its context is available even when
 * only some sentences are practised (retrying the wrong ones).
 */
export interface StoryInfo {
  title: string;
  topic: StoryTopic;
  /** The learner's own topic, when topic is 'custom' */
  customTopic?: string;
  tense?: Exclude<StoryTense, 'random'>;
  paragraphs: StorySentence[][];
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
  verdict?: Verdict;
  correctedAnswer?: string;
  alternatives?: string[];
}

// ─── Question Result ────────────────────────────────────
export interface QuestionResult {
  question: Question;
  attempts: Attempt[];
  isCorrect: boolean;
  totalTimeMs: number;
  finalTranscript: string;
  revealedAnswer: boolean;
  /** How many hint steps were opened before answering */
  hintsUsed?: number;
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
  /** Story translation sessions */
  story?: StoryInfo;
  /** Questions asked for, when fewer could be made (kanji) */
  requestedCount?: number;
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
  story?: { title: string };
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
  translationFormat: TranslationFormat;
  storyParagraphs: number;
  storyTopic: StoryTopic;
  storyCustomTopic: string;
  storyTense: StoryTense;
  kanjiSessionType: KanjiSessionType;
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
  translationFormat: 'story',
  storyParagraphs: 2,
  storyTopic: 'random',
  storyCustomTopic: '',
  storyTense: 'random',
  kanjiSessionType: 'new',
};

// ─── Kanji progress ─────────────────────────────────────
/** What the learner has done with one kanji, across all sessions (kanji mode). */
export interface KanjiProgress {
  /** Curriculum level the kanji was practised at */
  level: JLPTLevel;
  firstSeenAt: number;
  lastSeenAt: number;
  /** Questions that targeted this kanji */
  attempts: number;
  correct: number;
  incorrect: number;
  /** Right on the first attempt, without Show Answer, this many times in a row */
  streak: number;
  /** When it should come back for review */
  dueAt: number;
  /** Words already used for it, newest last, so the next question uses another word */
  words: string[];
}

// ─── AI Evaluation Response ─────────────────────────────
/** natural and slightly_unnatural count as correct */
export type Verdict = 'natural' | 'slightly_unnatural' | 'grammar_errors' | 'partial' | 'incorrect';

export const VERDICTS: Verdict[] = ['natural', 'slightly_unnatural', 'grammar_errors', 'partial', 'incorrect'];

export interface EvaluationResponse {
  correct: boolean;
  transcript: string;
  feedback: string;
  grammarNotes: string[];
  vocabularyNotes: string[];
  hint: string | null;
  nextAction: 'next_question' | 'retry' | 'reveal_answer';
  /** AI-evaluated answers only */
  verdict?: Verdict;
  /** The user's answer with its mistakes fixed, or a more natural version */
  correctedAnswer?: string;
  /** Other natural ways to say it */
  alternatives?: string[];
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
