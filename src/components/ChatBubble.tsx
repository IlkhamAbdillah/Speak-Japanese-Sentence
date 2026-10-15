import { useState } from 'react';
import { Volume2, Languages, PencilLine } from 'lucide-react';
import type { ConversationMessage, InstructionLanguage } from '../types';
import { speakJapanese, isSpeechSynthesisSupported } from '../services/speech';

interface ChatBubbleProps {
  message: ConversationMessage;
  lang: InstructionLanguage;
  /** Show corrections expanded by default (e.g. on the recap page) */
  expandCorrection?: boolean;
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function ChatBubble({ message, lang, expandCorrection = false }: ChatBubbleProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [showCorrection, setShowCorrection] = useState(expandCorrection);
  const isAI = message.role === 'ai';

  return (
    <div className={`chat-row ${isAI ? 'chat-row-ai' : 'chat-row-user'}`}>
      {isAI && <div className="chat-avatar" aria-hidden="true">話</div>}

      <div className="chat-bubble-group">
        <div className={`chat-bubble ${isAI ? 'chat-bubble-ai' : 'chat-bubble-user'}`}>
          <div className="chat-bubble-text">{message.text}</div>
          {isAI && showTranslation && message.translation && (
            <div className="chat-bubble-translation">{message.translation}</div>
          )}
          <div className="chat-bubble-meta">
            {isAI && isSpeechSynthesisSupported() && (
              <button
                className="chat-bubble-action"
                onClick={() => speakJapanese(message.text)}
                title={lang === 'id' ? 'Dengarkan' : 'Listen'}
              >
                <Volume2 size={14} />
              </button>
            )}
            {isAI && message.translation && (
              <button
                className={`chat-bubble-action ${showTranslation ? 'active' : ''}`}
                onClick={() => setShowTranslation((v) => !v)}
                title={lang === 'id' ? 'Terjemahan' : 'Translation'}
              >
                <Languages size={14} />
              </button>
            )}
            <span className="chat-bubble-time">{formatTime(message.timestamp)}</span>
          </div>
        </div>

        {!isAI && message.correction && (
          <div className="chat-correction">
            <button className="chat-correction-toggle" onClick={() => setShowCorrection((v) => !v)}>
              <PencilLine size={12} />
              {showCorrection
                ? (lang === 'id' ? 'Sembunyikan koreksi' : 'Hide correction')
                : (lang === 'id' ? 'Lihat koreksi' : 'See correction')}
            </button>
            {showCorrection && (
              <div className="chat-correction-body">
                <div className="chat-correction-text">{message.correction.corrected}</div>
                {message.correction.explanation && (
                  <div className="chat-correction-explanation">{message.correction.explanation}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
