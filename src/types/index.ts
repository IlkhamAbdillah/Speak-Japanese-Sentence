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

/** Kanji list filter by progress (see kanjiStatus in services/kanjiProgress.ts) */
export type KanjiStatusFilter = 'all' | 'new' | 'learning' | 'known';
export const KANJI_STATUS_FILTERS: KanjiStatusFilter[] = ['all', 'new', 'learning', 'known'];
export type KanjiStatusValue = Exclude<KanjiStatusFilter, 'all'>;
export const KANJI_STATUS_VALUES: KanjiStatusValue[] = ['new', 'learning', 'known'];

// Kanji quiz (Kanji page, no AI): meaning: kanji → pick the meaning; kanji: meaning → pick
// the kanji; reading: kanji → pick its readings; say: kanji → say or type any reading
export type KanjiQuizType = 'mixed' | 'meaning' | 'kanji' | 'reading' | 'say';
export const KANJI_QUIZ_TYPES: KanjiQuizType[] = ['mixed', 'meaning', 'kanji', 'reading', 'say'];

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

// ─── Word list (verbs / adjectives / adverbs / conjunctions / onomatopoeia) ─
// A fixed list (src/data/vocab/words.json) with its own quiz, checked locally (no AI)
// No "all": the lists cover completely different areas (user-requested)
export type VocabCategory = 'onomatopoeia' | 'adverb' | 'conjunction' | 'verb' | 'adjective';

// Order of the list buttons (user-requested)
export const VOCAB_CATEGORIES: VocabCategory[] = ['verb', 'adjective', 'adverb', 'conjunction', 'onomatopoeia'];

// meaning: word → pick the meaning; word: meaning → pick the word;
// say: meaning → say or type the word; mixed: a random one of those per question
export type VocabQuizType = 'mixed' | 'meaning' | 'word' | 'say';

export const VOCAB_QUIZ_TYPES: VocabQuizType[] = ['mixed', 'meaning', 'word', 'say'];

/** Question count choices; 0 = every word of the category */
export const VOCAB_QUIZ_COUNTS = [10, 20, 30, 0];

// Word list filters (dropdowns); 'all' = no filter
export type VerbGroupFilter = 'all' | '1' | '2' | '3';
export const VERB_GROUP_FILTERS: VerbGroupFilter[] = ['all', '1', '2', '3'];

export type AdjTypeFilter = 'all' | 'i' | 'na';
export const ADJ_TYPE_FILTERS: AdjTypeFilter[] = ['all', 'i', 'na'];

/** A word's JLPT level, or 'none' for words on no JLPT list */
export type VocabJlptValue = JLPTLevel | 'none';

/** How common a verb is in everyday Japanese (from word frequency data) */
export type VocabFrequency = 'veryCommon' | 'common' | 'uncommon' | 'rare';
export const VOCAB_FREQUENCIES: VocabFrequency[] = ['veryCommon', 'common', 'uncommon', 'rare'];
export type VocabFrequencyFilter = 'all' | VocabFrequency;
export const VOCAB_FREQUENCY_FILTERS: VocabFrequencyFilter[] = ['all', ...VOCAB_FREQUENCIES];

// Quiz filters are multi-select buttons (user-requested), e.g. N5 + N4 and very common +
// common at once. Within one filter any picked value matches; nothing picked = everything.
export const VOCAB_JLPT_VALUES: VocabJlptValue[] = ['N5', 'N4', 'N3', 'N2', 'N1', 'none'];
export type VerbGroupValue = Exclude<VerbGroupFilter, 'all'>;
// The quiz has no group 3 button (user-requested): it is only する and 来る. The list dropdown keeps it.
export const VERB_GROUP_VALUES: VerbGroupValue[] = ['1', '2'];
export type AdjTypeValue = Exclude<AdjTypeFilter, 'all'>;
export const ADJ_TYPE_VALUES: AdjTypeValue[] = ['i', 'na'];

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
  vocabCategory: VocabCategory;
  vocabQuizType: VocabQuizType;
  vocabQuizCount: number;
  vocabVerbGroup: VerbGroupFilter;
  vocabAdjType: AdjTypeFilter;
  vocabFrequency: VocabFrequencyFilter;
  /** Word list: show the group / い・な stripe and the frequency bars */
  vocabShowDetails: boolean;
  /** Word list: collapsed JLPT sections, as "<category>:<level>" */
  vocabCollapsed: string[];
  /** Quiz filters; empty = no filter */
  vocabQuizJlpt: VocabJlptValue[];
  vocabQuizFrequency: VocabFrequency[];
  vocabQuizVerbGroups: VerbGroupValue[];
  vocabQuizAdjTypes: AdjTypeValue[];
  /** Kanji list: which kanji to show, by progress */
  kanjiStatusFilter: KanjiStatusFilter;
  /** Kanji list: collapsed JLPT sections */
  kanjiCollapsed: JLPTLevel[];
  /** Kanji list: only kanji containing this part (an id of PARTS in services/kanjiList.ts); '' = all */
  kanjiPart: string;
  /** Kanji quiz: question type and count (VOCAB_QUIZ_COUNTS; 0 = all) */
  kanjiQuizType: KanjiQuizType;
  kanjiQuizCount: number;
  /** Kanji quiz filters (multi-select); empty = no filter */
  kanjiQuizJlpt: JLPTLevel[];
  kanjiQuizStatus: KanjiStatusValue[];
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
  vocabCategory: 'verb',
  vocabQuizType: 'mixed',
  vocabQuizCount: 10,
  vocabVerbGroup: 'all',
  vocabAdjType: 'all',
  vocabFrequency: 'all',
  vocabShowDetails: true,
  vocabCollapsed: [],
  vocabQuizJlpt: [],
  vocabQuizFrequency: [],
  vocabQuizVerbGroups: [],
  vocabQuizAdjTypes: [],
  kanjiStatusFilter: 'all',
  kanjiCollapsed: [],
  kanjiPart: '',
  kanjiQuizType: 'mixed',
  kanjiQuizCount: 10,
  kanjiQuizJlpt: ['N5'],
  kanjiQuizStatus: [],
};

// ─── Kanji progress ─────────────────────────────────────
/** What the learner has done with one kanji: its reading practices on the Kanji page (and old mock-test sessions). */
export interface KanjiProgress {
  /** Curriculum level the kanji was practised at */
  level: JLPTLevel;
  firstSeenAt: number;
  lastSeenAt: number;
  /** Practices of this kanji (old data: mock-test questions) */
  attempts: number;
  correct: number;
  incorrect: number;
  /** Good practices (right on the first try, without Show Answer) this many times in a row */
  streak: number;
  /** When it should come back for review */
  dueAt: number;
  /** Words practised with it, newest last */
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
