// ─── App Modes ──────────────────────────────────────────
// practice: translation / situation / conversation practice
// jlpt:     JLPT mock test — kanji reading or reading comprehension
// Practice (except conversation) and the kanji section can be played as an exam
// (see UserSettings.examMode); reading is always one attempt.
export type AppMode = 'practice' | 'jlpt';

/** Older sessions may carry modes that no longer exist. */
export type StoredAppMode = AppMode | 'exam' | 'kanji';

export const APP_MODE_LABELS: Record<AppMode, { en: string; id: string }> = {
  practice: { en: 'Practice', id: 'Latihan' },
  jlpt: { en: 'JLPT Mock Test', id: 'Simulasi JLPT' },
};

export const APP_MODE_DESCRIPTIONS: Record<AppMode, { en: string; id: string }> = {
  practice: {
    en: 'Translate sentences, respond to situations, or chat with AI',
    id: 'Terjemahkan kalimat, tanggapi situasi, atau mengobrol dengan AI',
  },
  jlpt: {
    en: 'JLPT-style questions: kanji and reading',
    id: 'Soal bergaya JLPT: kanji dan membaca',
  },
};

// ─── JLPT Mock Test Sections ────────────────────────────
export type JLPTSection = 'kanji' | 'reading';

export const JLPT_SECTION_LABELS: Record<JLPTSection, { en: string; id: string }> = {
  kanji: { en: 'Kanji', id: 'Kanji' },
  reading: { en: 'Reading', id: 'Membaca' },
};

export const JLPT_SECTION_DESCRIPTIONS: Record<JLPTSection, { en: string; id: string }> = {
  kanji: {
    en: 'See a kanji word and type or say how it is read',
    id: 'Lihat kata kanji lalu ketik atau ucapkan cara membacanya',
  },
  reading: {
    en: 'Read a short Japanese text and answer 3 multiple-choice questions',
    id: 'Baca teks bahasa Jepang singkat dan jawab 3 soal pilihan ganda',
  },
};

/** Reading tests always have one passage with this many questions. */
export const READING_QUESTION_COUNT = 3;

export const EXAM_MODE_LABEL = { en: 'Exam', id: 'Ujian' } as const;

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
  session: { appMode?: StoredAppMode; jlptSection?: JLPTSection; examMode?: boolean; mode: string },
  lang: InstructionLanguage
): string {
  // Sessions saved when "exam" was its own mode
  if (session.appMode === 'exam') return EXAM_MODE_LABEL[lang];

  const jlptSection = session.appMode === 'kanji' ? 'kanji' : session.jlptSection;
  const base = jlptSection
    ? `JLPT · ${JLPT_SECTION_LABELS[jlptSection][lang]}`
    : session.mode in EXERCISE_MODE_LABELS
      ? EXERCISE_MODE_LABELS[session.mode as ExerciseMode][lang]
      : (lang === 'id' ? 'Respons Bahasa Jepang' : 'Japanese Response');
  return session.examMode ? `${base} · ${EXAM_MODE_LABEL[lang]}` : base;
}

type ModeSettings = Pick<UserSettings, 'appMode' | 'exerciseMode' | 'jlptSection' | 'examMode'>;

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

/** Whether the "Exam mode" toggle applies: not to conversation, and multiple choice is always one attempt. */
export function canUseExamMode(settings: Omit<ModeSettings, 'examMode'>): boolean {
  return !isConversationMode(settings) && !isMultipleChoiceMode(settings);
}

/** Exam = one attempt per question with the explanation shown right away. */
export function isExamMode(settings: ModeSettings): boolean {
  return settings.examMode && canUseExamMode(settings);
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
  jlptSection: JLPTSection;
  /** One attempt per question (practice types except conversation, and kanji) */
  examMode: boolean;
  jlptLevel: JLPTLevel;
  instructionLanguage: InstructionLanguage;
  questionCount: number;
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
  examMode: false,
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
