import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Send, X, Shuffle, MessageCircle, AlertCircle, RotateCcw } from 'lucide-react';
import type { UserSettings } from '../types';
import { useConversation } from '../hooks/useConversation';
import { loadActiveSession } from '../services/storage';
import { usePushToTalk } from '../hooks/usePushToTalk';
import { useMicShortcut } from '../hooks/useMicShortcut';
import ChatBubble from '../components/ChatBubble';
import ConfirmDialog from '../components/ConfirmDialog';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useI18n } from '../i18n';
import SettingsButton from '../components/SettingsButton';
import { Kbd } from '../components/Kbd';
import topicData from '../data/conversation/topics.json';
import type { InstructionLanguage } from '../i18n';
import {
  startRecognition,
  stopRecognition,
  finishRecognition,
  isSpeechRecognitionSupported,
  prefersPushToTalk,
} from '../services/speech';

// Ready-made situations for Random topic (src/data/conversation/topics.json)
const TOPICS = topicData.topics as (Partial<Record<InstructionLanguage, string>> & { en: string })[];

interface ConversationPageProps {
  settings: UserSettings;
  onFinish: (sessionId: string) => void;
  onExit: () => void;
  /** Leave the chat for Settings (next to AI errors) */
  onOpenSettings: () => void;
  /** Continue the conversation saved before a page reload */
  resume?: boolean;
}

export default function ConversationPage({ settings, onFinish, onExit, onOpenSettings, resume: resumeSaved }: ConversationPageProps) {
  const { t, lang } = useI18n();
  const { session, messages, isWaitingForAI, error, start, resume, send, retry, end } = useConversation(settings);

  // Continue the conversation that was open when the page was reloaded
  // (once: React StrictMode runs mount effects twice in dev)
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || !resumeSaved) return;
    resumedRef.current = true;
    const saved = loadActiveSession(settings);
    if (saved?.session.conversation) resume(saved.session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [topicInput, setTopicInput] = useState('');
  const topicRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');
  const [isListening, setIsListening] = useState(false);
  // Push-to-talk: the phone stopped listening while the mic is still held
  const [micStopped, setMicStopped] = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  // Esc asks before ending the conversation (user-requested)
  useEscapeKey(() => setShowConfirmEnd(true), !!session && !showConfirmEnd);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isWaitingForAI, error]);

  // Stop the microphone when leaving the page
  useEffect(() => () => stopRecognition(), []);

  const pushToTalk = prefersPushToTalk();

  // The mic stays on until the user turns it off. Spoken text goes after whatever
  // was already typed; `base` is that typed text.
  const listen = (base: string) => {
    const prefix = base ? `${base} ` : '';
    setMicStopped(false);
    const started = startRecognition({
      onInterimResult: (t) => setDraft(prefix + t),
      // Push-to-talk released
      onFinalResult: (t) => {
        setDraft(prefix + t);
        setIsListening(false);
      },
      onError: () => setIsListening(false),
      onEnd: () => setIsListening(false),
      onStopped: () => setMicStopped(true),
    }, { untilStopped: true, restartOnEnd: !pushToTalk });
    setIsListening(started);
  };

  const handleSend = () => {
    if (!draft.trim() || isWaitingForAI) return;
    send(draft);
    setDraft('');
    // Keep the mic on for the next message, starting from an empty box
    if (isListening) listen('');
  };

  const toggleListening = () => {
    if (isListening) {
      // Stop only turns the mic off: what was heard stays in the box
      stopRecognition();
      setIsListening(false);
      return;
    }
    listen(draft);
  };

  // Phones: hold the mic to talk, release to stop (the text stays in the box),
  // slide away and release to cancel (the box goes back to what was typed before)
  const draftBeforeHold = useRef('');
  const ptt = usePushToTalk({
    onStart: () => {
      draftBeforeHold.current = draft;
      listen(draft);
    },
    onRelease: finishRecognition,
    onCancel: () => {
      stopRecognition();
      setIsListening(false);
      setDraft(draftBeforeHold.current);
    },
  });
  const micHandlers = pushToTalk ? ptt.handlers : { onClick: toggleListening };
  // V = the mic button on laptops (user-requested)
  useMicShortcut(toggleListening, !!session && isSpeechRecognitionSupported(), isListening);

  const handleEnd = () => {
    stopRecognition();
    const savedId = end();
    if (savedId) onFinish(savedId);
    else onExit();
  };

  const userMessageCount = messages.filter((m) => m.role === 'user').length;

  // ─── Topic setup ──────────────────────────────────────
  // Random topic: a situation from the app's list in the UI language, never the one in the box
  const fillRandomTopic = () => {
    const current = topicInput.trim();
    const choices = TOPICS.map((topic) => topic[lang] ?? topic.en).filter((topic) => topic !== current);
    setTopicInput(choices[Math.floor(Math.random() * choices.length)]);
    topicRef.current?.focus();
  };

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
              ref={topicRef}
              className="form-input chat-topic-input"
              rows={3}
              autoFocus
              placeholder={t('conversation.topicPlaceholder')}
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter starts (Shift+Enter = new line); not while the IME is converting
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (topicInput.trim()) start(topicInput.trim());
                }
              }}
            />
          </div>

          {/* Primary (start with the topic) on the right (user-requested) */}
          <div className="start-card-actions" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={onExit}>
              {t('common.back')}
            </button>
            {/* Fills the box with a ready-made situation to start with or edit (user-requested) */}
            <button className="btn btn-secondary" onClick={fillRandomTopic}>
              <Shuffle size={16} />
              {t('common.randomTopic')}
            </button>
            <button
              className="btn btn-primary"
              disabled={!topicInput.trim()}
              onClick={() => start(topicInput.trim())}
            >
              <MessageCircle size={16} />
              {t('practice.startSession')}
              <Kbd k="Enter" />
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
            <SettingsButton onClick={onOpenSettings} />
          </div>
        )}
      </div>

      {pushToTalk && ptt.isHolding && (
        <div className={`ptt-hint ${ptt.cancelArmed ? 'cancel-armed' : ''}`}>
          {ptt.cancelArmed
            ? t('common.releaseToCancel')
            : micStopped ? t('common.micStoppedHold') : t('common.slideToCancel')}
        </div>
      )}

      <div className="chat-composer">
        {isSpeechRecognitionSupported() && (
          <button
            className={`chat-composer-btn ${pushToTalk ? 'push-to-talk' : ''} ${isListening ? 'listening' : ''} ${ptt.cancelArmed ? 'cancel-armed' : ''}`}
            style={pushToTalk ? ptt.buttonStyle : undefined}
            {...micHandlers}
            title={pushToTalk ? t('common.holdToTalk') : isListening ? t('common.stopMic') : t('common.speak')}
          >
            {ptt.cancelArmed ? <X size={18} /> : isListening ? <Square size={18} /> : <Mic size={18} />}
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
        <ConfirmDialog
          title={t('conversation.endTitle')}
          text={userMessageCount > 0
            ? t('conversation.endText', { count: userMessageCount })
            : t('conversation.endTextEmpty')}
          confirmLabel={t('conversation.endConfirm')}
          confirmClass="btn-primary"
          onCancel={() => setShowConfirmEnd(false)}
          onConfirm={handleEnd}
        />
      )}
    </div>
  );
}
