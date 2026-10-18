import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Send, X, Shuffle, MessageCircle, AlertCircle, RotateCcw } from 'lucide-react';
import type { UserSettings } from '../types';
import { useConversation } from '../hooks/useConversation';
import ChatBubble from '../components/ChatBubble';
import { useI18n } from '../i18n';
import {
  startRecognition,
  stopRecognition,
  isSpeechRecognitionSupported,
} from '../services/speech';

interface ConversationPageProps {
  settings: UserSettings;
  onFinish: (sessionId: string) => void;
  onExit: () => void;
}

export default function ConversationPage({ settings, onFinish, onExit }: ConversationPageProps) {
  const { t } = useI18n();
  const { session, messages, isWaitingForAI, error, start, send, retry, end } = useConversation(settings);

  const [topicInput, setTopicInput] = useState('');
  const [draft, setDraft] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const draftBeforeListening = useRef('');

  // Keep the newest message in view
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isWaitingForAI, error]);

  // Stop the microphone when leaving the page
  useEffect(() => () => stopRecognition(), []);

  const handleSend = () => {
    if (!draft.trim() || isWaitingForAI) return;
    stopRecognition();
    setIsListening(false);
    send(draft);
    setDraft('');
  };

  const toggleListening = () => {
    if (isListening) {
      // Cancel: drop what was heard and restore the message as it was before speaking
      stopRecognition();
      setIsListening(false);
      setDraft(draftBeforeListening.current);
      return;
    }
    // Spoken text is appended to whatever is already typed, so it can be checked before sending
    draftBeforeListening.current = draft;
    const base = draft ? `${draft} ` : '';
    const started = startRecognition({
      onInterimResult: (t) => setDraft(base + t),
      onFinalResult: (t) => {
        setDraft(base + t);
        setIsListening(false);
      },
      onError: () => setIsListening(false),
      onEnd: () => setIsListening(false),
    });
    setIsListening(started);
  };

  const handleEnd = () => {
    stopRecognition();
    const savedId = end();
    if (savedId) onFinish(savedId);
    else onExit();
  };

  const userMessageCount = messages.filter((m) => m.role === 'user').length;

  // ─── Topic setup ──────────────────────────────────────
  if (!session) {
    return (
      <div className="app-main" style={{ maxWidth: 640 }}>
        <div className="start-card animate-in" style={{ marginTop: 'var(--space-2xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
            <MessageCircle size={20} style={{ color: 'var(--accent-primary)' }} />
            <h2 className="card-title">{t('modes.exercise.conversation.label')}</h2>
            <span className="badge badge-accent">{settings.jlptLevel}</span>
          </div>
          <p className="card-subtitle" style={{ marginBottom: 'var(--space-lg)' }}>
            {t('conversation.intro')}
          </p>

          <div className="form-group">
            <label className="form-label">
              {t('conversation.topicLabel')}
            </label>
            <textarea
              className="form-input chat-topic-input"
              rows={3}
              placeholder={t('conversation.topicPlaceholder')}
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
            />
          </div>

          <div className="start-card-actions" style={{ flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              disabled={!topicInput.trim()}
              onClick={() => start(topicInput.trim())}
            >
              <MessageCircle size={16} />
              {t('conversation.startWithTopic')}
            </button>
            <button className="btn btn-secondary" onClick={() => start(null)}>
              <Shuffle size={16} />
              {t('common.randomTopic')}
            </button>
            <button className="btn btn-ghost" onClick={onExit}>
              {t('common.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Chat ─────────────────────────────────────────────
  const topic = session.conversation?.topic;

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="chat-avatar" aria-hidden="true">話</div>
        <div className="chat-header-info">
          <div className="chat-header-title">
            {t('conversation.partner')}
            <span className="badge badge-accent">{session.jlptLevel}</span>
          </div>
          <div className="chat-header-subtitle">
            {isWaitingForAI
              ? t('conversation.typing')
              : topic || t('common.randomTopic')}
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => (userMessageCount > 0 ? setShowConfirmEnd(true) : handleEnd())}
        >
          <X size={16} /> {t('conversation.end')}
        </button>
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}

        {isWaitingForAI && (
          <div className="chat-row chat-row-ai">
            <div className="chat-avatar" aria-hidden="true">話</div>
            <div className="chat-bubble chat-bubble-ai chat-typing" aria-label={t('conversation.typing')}>
              <span /><span /><span />
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-error chat-error">
            <AlertCircle size={16} />
            <span style={{ flex: 1 }}>{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={retry}>
              <RotateCcw size={14} /> {t('common.retry')}
            </button>
          </div>
        )}
      </div>

      <div className="chat-composer">
        {isSpeechRecognitionSupported() && (
          <button
            className={`chat-composer-btn ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
            title={isListening ? t('common.cancelRecording') : t('common.speak')}
          >
            {isListening ? <Square size={18} /> : <Mic size={18} />}
          </button>
        )}
        <input
          className="chat-composer-input"
          placeholder={isListening
            ? t('common.listening')
            : t('conversation.composerPlaceholder')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Don't send while an IME (kana → kanji) conversion is in progress
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend();
          }}
        />
        <button
          className="chat-composer-btn chat-composer-send"
          onClick={handleSend}
          disabled={!draft.trim() || isWaitingForAI}
          title={t('common.send')}
        >
          <Send size={18} />
        </button>
      </div>

      {showConfirmEnd && (
        <div className="dialog-overlay" onClick={() => setShowConfirmEnd(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog-title">{t('conversation.endTitle')}</h3>
            <p className="dialog-text">
              {t('conversation.endText', { count: userMessageCount })}
            </p>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirmEnd(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" onClick={handleEnd}>
                {t('conversation.endConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
