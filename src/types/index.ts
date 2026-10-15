// ─── App Modes ──────────────────────────────────────────
// practice: free practice with retries (translation / situation / conversation)
// exam:     one attempt per question, explanation shown after answering
// kanji:    read a kanji word and answer with its reading
export type AppMode = 'practice' | 'exam' | 'kanji';

export const APP_MODE_LABELS: Record<AppMode, { en: string; id: string }> = {
  practice: { en: 'Practice', id: 'Latihan' },
  exam: { en: 'Exam', id: 'Ujian' },
  kanji: { en: 'Kanji Recognition', id: 'Mengenal Kanji' },
};

export const APP_MODE_DESCRIPTIONS: Record<AppMode, { en: string; id: string }> = {
  practice: {
    en: 'Practice with retries, hints, and feedback',
    id: 'Latihan dengan pengulangan, petunjuk, dan umpan balik',
  },
  exam: {
    en: 'One attempt per question — the explanation appears after you answer',
    id: 'Satu kali jawab per soal — penjelasan muncul setelah menjawab',
  },
  kanji: {
    en: 'See a kanji word and write or say how it is read',
    id: 'Lihat kata kanji lalu tulis atau ucapkan cara membacanya',
  },
};

// ─── Exercise Modes (Practice types) ────────────────────
export type ExerciseMode = 'translation' | 'situation' | 'conversation';

export const EXERCISE_MODE_LABELS: Record<ExerciseMode, { en: string; id: string }> = {
  translation: { en: 'Translation Practice', id: 'Latihan Terjemahan' },
  situation: { en: 'Situation Practice', id: 'Latihan Situasi' },
  conversation: { en: 'Conversation Practice', id: 'Latihan Percakapan' },
};

export const EXERCISE_MODE_DESCRIPTIONS: Record<ExerciseMode, { en: string; id: string }> = {
  translation: {
    en: 'Read a sentence and translate it into Japanese',
    id: 'Baca kalimat dan terjemahkan ke bahasa Jepang',
  },
  situation: {
    en: 'Respond to a real-world situation in Japanese',
    id: 'Merespons situasi nyata dalam bahasa Jepang',
  },
  conversation: {
    en: 'Chat freely with AI in Japanese, like a messaging app',
    id: 'Mengobrol bebas dengan AI dalam bahasa Jepang, seperti aplikasi chat',
  },
};

/** Label for a session, tolerating sessions saved before modes changed. */
export function getSessionModeLabel(
  appMode: AppMode | undefined,
  mode: string,
  lang: InstructionLanguage
): string {
  if (appMode === 'exam' || appMode === 'kanji') return APP_MODE_LABELS[appMode][lang];
  if (mode in EXERCISE_MODE_LABELS) return EXERCISE_MODE_LABELS[mode as ExerciseMode][lang];
  return lang === 'id' ? 'Respons Bahasa Jepang' : 'Japanese Response';
}

// ─── JLPT Levels ────────────────────────────────────────
export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export const JLPT_DESCRIPTIONS: Record<JLPTLevel, { en: string; id: string }> = {
  N5: {
    en: 'Basic expressions, introductions, common vocabulary',
    id: 'Ekspresi dasar, perkenalan, kosakata umum',
  },
  N4: {
    en: 'Everyday conversations and basic connected sentences',
    id: 'Percakapan sehari-hari dan kalimat dasar',
  },
  N3: {
    en: 'Intermediate everyday communication',
    id: 'Komunikasi sehari-hari tingkat menengah',
  },
  N2: {
    en: 'Broader vocabulary and nuanced expressions',
    id: 'Kosakata luas dan ekspresi bernuansa',
  },
  N1: {
    en: 'Advanced vocabulary and complex natural Japanese',
    id: 'Kosakata tingkat lanjut dan bahasa Jepang alami',
  },
};

// ─── Instruction Language ───────────────────────────────
export type InstructionLanguage = 'en' | 'id';

// ─── Question ───────────────────────────────────────────
export type QuestionMode = 'translation' | 'situation' | 'kanji';

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
  /** Example usage (kanji mode) */
  example?: { japanese: string; translation: string };
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
  /** Missing on sessions saved before app modes existed (treated as 'practice') */
  appMode?: AppMode;
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
  appMode?: AppMode;
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
  ollama: 'Ollama',
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
  jlptLevel: JLPTLevel;
  instructionLanguage: InstructionLanguage;
  questionCount: number;
  maxAttempts: number;
  hintsEnabled: boolean;
  autoAdvance: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  aiProvider: 'google',
  aiModel: 'gemini-2.5-flash',
  apiKey: '',
  ollamaBaseUrl: 'http://localhost:11434/v1',
  appMode: 'practice',
  exerciseMode: 'translation',
  jlptLevel: 'N5',
  instructionLanguage: 'en',
  questionCount: 5,
  maxAttempts: 3,
  hintsEnabled: true,
  autoAdvance: false,
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
