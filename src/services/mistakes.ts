import type { AppMode, ConversationMessage, ExerciseMode, JLPTLevel, JLPTSection, QuestionResult, Session, StoryInfo } from '../types';
import { APP_MODES, JLPT_SECTIONS } from '../types';

/**
 * The Mistakes page: every question answered wrong in a saved session, worked
 * out locally from `sjp_sessions` (no AI call). A question leaves the list once
 * its latest answer is right (e.g. in a "Practice these" session, which reuses
 * the same questionId) or when the learner removes it.
 */

export type MistakeKind = 'translation' | 'situation' | 'story' | 'kanji' | 'reading';

export const MISTAKE_KINDS: MistakeKind[] = ['translation', 'situation', 'story', 'kanji', 'reading'];

/** At most this many questions per "Practice these" session (a story is practised whole). */
export const MISTAKE_PRACTICE_LIMIT = 10;

export interface QuestionMistake {
  /** questionId: the same question in a retry session has the same id */
  key: string;
  sessionId: string;
  at: number;
  result: QuestionResult;
}

/** The settings a practice session of the group needs (like Retry Wrong Answers). */
export interface MistakePracticeMode {
  appMode: AppMode;
  exerciseMode: ExerciseMode;
  jlptSection?: JLPTSection;
  jlptLevel: JLPTLevel;
}

export interface MistakeGroup {
  id: string;
  kind: MistakeKind;
  /** Story groups: one per story, because the evaluator needs the story around a sentence */
  story?: StoryInfo;
  /** Newest first (story groups: in story order) */
  items: QuestionMistake[];
  mode: MistakePracticeMode;
}

export interface ConversationMistake {
  key: string;
  sessionId: string;
  at: number;
  topic: string | null;
  message: ConversationMessage;
}

export interface Mistakes {
  groups: MistakeGroup[];
  conversation: ConversationMistake[];
}

/** Which list a session's questions belong to, or null for modes that no longer exist. */
function kindOf(session: Session): MistakeKind | null {
  const appMode = session.appMode ?? 'practice';
  if (!(APP_MODES as string[]).includes(appMode)) return null;
  if (appMode === 'jlpt') {
    return session.jlptSection && JLPT_SECTIONS.includes(session.jlptSection) ? session.jlptSection : null;
  }
  if (session.mode === 'situation') return 'situation';
  if (session.mode === 'translation') return session.story ? 'story' : 'translation';
  return null;
}

/** A story is recognised by its title and first sentence (a retry session keeps the same story). */
const storyId = (story: StoryInfo) => `story:${story.title}|${story.paragraphs[0]?.[0]?.source ?? ''}`;

const storyOrder = (m: QuestionMistake) =>
  (m.result.question.paragraphIndex ?? 0) * 1000 + (m.result.question.sentenceIndex ?? 0);

export function collectMistakes(sessions: Session[], dismissed: ReadonlySet<string>): Mistakes {
  // Oldest first, so a later answer to the same question replaces an earlier one
  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  const latest = new Map<string, { item: QuestionMistake; groupId: string; kind: MistakeKind; session: Session }>();
  const conversation: ConversationMistake[] = [];

  for (const session of ordered) {
    if (session.conversation) {
      for (const message of session.conversation.messages) {
        if (message.role !== 'user' || !message.correction) continue;
        const key = `${session.sessionId}:${message.id}`;
        if (dismissed.has(key)) continue;
        conversation.push({ key, sessionId: session.sessionId, at: message.timestamp, topic: session.conversation.topic, message });
      }
      continue;
    }

    const kind = kindOf(session);
    if (!kind) continue;
    const groupId = kind === 'story' && session.story ? storyId(session.story) : kind;
    for (const result of session.results) {
      const key = result.question.questionId;
      latest.set(key, { item: { key, sessionId: session.sessionId, at: session.startedAt, result }, groupId, kind, session });
    }
  }

  const groups = new Map<string, MistakeGroup>();
  for (const { item, groupId, kind, session } of latest.values()) {
    if (item.result.isCorrect || dismissed.has(item.key)) continue;
    let group = groups.get(groupId);
    if (!group) {
      group = {
        id: groupId,
        kind,
        story: kind === 'story' ? session.story : undefined,
        items: [],
        mode: {
          appMode: (session.appMode ?? 'practice') as AppMode,
          exerciseMode: session.mode,
          jlptSection: session.jlptSection,
          jlptLevel: session.jlptLevel,
        },
      };
      groups.set(groupId, group);
    }
    group.items.push(item);
  }

  const result = [...groups.values()];
  for (const group of result) {
    if (group.kind === 'story') group.items.sort((a, b) => storyOrder(a) - storyOrder(b));
    else group.items.sort((a, b) => b.at - a.at);
    // Practise at the level of the newest mistake
    const newest = group.items.reduce((a, b) => (b.at > a.at ? b : a));
    group.mode.jlptLevel = newest.result.question.jlptLevel;
  }

  const newestAt = (g: MistakeGroup) => Math.max(...g.items.map((i) => i.at));
  result.sort((a, b) =>
    MISTAKE_KINDS.indexOf(a.kind) - MISTAKE_KINDS.indexOf(b.kind) || newestAt(b) - newestAt(a)
  );

  return { groups: result, conversation: conversation.sort((a, b) => b.at - a.at) };
}

/** The questions for a "Practice these" session of a group. */
export function practiceQuestions(group: MistakeGroup) {
  const items = group.kind === 'story' ? group.items : group.items.slice(0, MISTAKE_PRACTICE_LIMIT);
  return items.map((i) => i.result.question);
}
