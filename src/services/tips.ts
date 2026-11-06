import type { UserSettings } from '../types';
import { isKanjiMode, isMultipleChoiceMode, isSingleAttemptMode } from '../types';

// Which How to answer tips a session shows (components/AnswerTips.tsx)

/** What is answered: a sentence (speaking practice, grammar practice), a kanji reading, a choice, or particles */
export type TipsKind = 'sentence' | 'kanji' | 'choice' | 'grammar' | 'particle';

export interface AnswerTipsProps {
  kind: TipsKind;
  /** Hint (or Key words) can be opened */
  hints?: boolean;
  /** One attempt: no Try again */
  singleAttempt?: boolean;
}

/** The tips for a speaking practice / JLPT session, from its settings */
export function tipsForSettings(settings: UserSettings): AnswerTipsProps {
  const kanji = isKanjiMode(settings);
  const choice = isMultipleChoiceMode(settings);
  const singleAttempt = isSingleAttemptMode(settings);
  return {
    kind: choice ? 'choice' : kanji ? 'kanji' : 'sentence',
    hints: settings.hintsEnabled && !singleAttempt && !kanji && !choice,
    singleAttempt,
  };
}
