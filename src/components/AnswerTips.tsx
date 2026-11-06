import type { ReactNode } from 'react';
import { Keyboard, Lightbulb, ListChecks, MessageSquareQuote, Mic, Sparkles } from 'lucide-react';
import type { AnswerTipsProps } from '../services/tips';
import { isSpeechRecognitionSupported, prefersPushToTalk } from '../services/speech';
import { useI18n } from '../i18n';

/**
 * How to answer, shown while the AI writes the questions (instead of a spinner,
 * user-requested) in every AI feature: Speaking Practice / JLPT, the grammar practice
 * and the particle quiz. Short on purpose: one line each for answering, typing and
 * getting help, for a laptop (Alt keys) or a phone (hold to talk).
 */
export default function AnswerTips({ kind, hints = false }: AnswerTipsProps) {
  const { t } = useI18n();
  const speech = isSpeechRecognitionSupported();
  const pushToTalk = prefersPushToTalk();

  // Kept simple (user-requested): how to answer, and where help is (+ the 「それは」 line for kanji)
  const tips: { icon: ReactNode; text: string }[] = [];
  const mic = speech && !pushToTalk;
  if (kind === 'choice') {
    tips.push({ icon: <ListChecks size={16} />, text: t('tips.choice') });
  } else if (kind === 'particle') {
    tips.push({ icon: <Keyboard size={16} />, text: t(pushToTalk ? 'tips.particleTouch' : 'tips.particleType') });
    tips.push({ icon: <Sparkles size={16} />, text: t('tips.particleAI') });
  } else {
    const kanji = kind === 'kanji';
    tips.push({
      icon: speech ? <Mic size={16} /> : <Keyboard size={16} />,
      text: t(pushToTalk && speech ? (kanji ? 'tips.holdKanji' : 'tips.hold')
        : mic ? (kanji ? 'tips.speakKanji' : 'tips.speak')
          : kanji ? 'tips.typeKanji' : 'tips.type'),
    });
    if (kanji && speech) tips.push({ icon: <MessageSquareQuote size={16} />, text: t('tips.kanjiPhrase') });
    const helpKey = pushToTalk ? 'tips.helpTouch'
      : kind === 'grammar' ? 'tips.helpWords' : hints ? 'tips.helpHint' : 'tips.help';
    tips.push({ icon: <Lightbulb size={16} />, text: t(helpKey) });
  }

  return (
    <section className="answer-tips animate-in" aria-label={t('tips.title')}>
      <h2 className="answer-tips-title">{t('tips.title')}</h2>
      <ul className="answer-tips-list">
        {tips.map((tip, i) => (
          <li key={i}>
            <span className="answer-tips-icon">{tip.icon}</span>
            <span>{tip.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
