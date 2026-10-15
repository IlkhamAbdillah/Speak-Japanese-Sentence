import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Send, X, Shuffle, MessageCircle, AlertCircle, RotateCcw } from 'lucide-react';
import type { UserSettings } from '../types';
import { useConversation } from '../hooks/useConversation';
import ChatBubble from '../components/ChatBubble';
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
  const lang = settings.instructionLanguage;
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
            <h2 className="card-title">{lang === 'id' ? 'Latihan Percakapan' : 'Conversation Practice'}</h2>
            <span className="badge badge-accent">{settings.jlptLevel}</span>
          </div>
          <p className="card-subtitle" style={{ marginBottom: 'var(--space-lg)' }}>
            {lang === 'id'
              ? 'Mengobrol dengan AI dalam bahasa Jepang. Tentukan topik sendiri atau biarkan AI memilih topik acak.'
              : 'Chat with AI in Japanese. Choose your own topic, or let the AI start a random one.'}
          </p>

          <div className="form-group">
            <label className="form-label">
              {lang === 'id' ? 'Topik / konteks (opsional)' : 'Topic / context (optional)'}
            </label>
            <textarea
              className="form-input chat-topic-input"
              rows={3}
              placeholder={lang === 'id'
                ? 'mis. Memesan makanan di restoran, kamu pelayannya'
                : 'e.g. Ordering food at a restaurant, you are the waiter'}
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
              {lang === 'id' ? 'Mulai dengan topik ini' : 'Start with this topic'}
            </button>
            <button className="btn btn-secondary" onClick={() => start(null)}>
              <Shuffle size={16} />
              {lang === 'id' ? 'Topik acak' : 'Random topic'}
            </button>
            <button className="btn btn-ghost" onClick={onExit}>
              {lang === 'id' ? 'Kembali' : 'Back'}
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
            {lang === 'id' ? 'Teman Bicara AI' : 'AI Chat Partner'}
            <span className="badge badge-accent">{session.jlptLevel}</span>
          </div>
          <div className="chat-header-subtitle">
            {isWaitingForAI
              ? (lang === 'id' ? 'sedang mengetik…' : 'typing…')
              : topic || (lang === 'id' ? 'Topik acak' : 'Random topic')}
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => (userMessageCount > 0 ? setShowConfirmEnd(true) : handleEnd())}
        >
          <X size={16} /> {lang === 'id' ? 'Selesai' : 'End'}
        </button>
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} lang={lang} />
        ))}

        {isWaitingForAI && (
          <div className="chat-row chat-row-ai">
            <div className="chat-avatar" aria-hidden="true">話</div>
            <div className="chat-bubble chat-bubble-ai chat-typing" aria-label="typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-error chat-error">
            <AlertCircle size={16} />
            <span style={{ flex: 1 }}>{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={retry}>
              <RotateCcw size={14} /> {lang === 'id' ? 'Coba lagi' : 'Retry'}
            </button>
          </div>
        )}
      </div>

      <div className="chat-composer">
        {isSpeechRecognitionSupported() && (
          <button
            className={`chat-composer-btn ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
            title={isListening ? (lang === 'id' ? 'Batalkan rekaman' : 'Cancel recording') : (lang === 'id' ? 'Bicara' : 'Speak')}
          >
            {isListening ? <Square size={18} /> : <Mic size={18} />}
          </button>
        )}
        <input
          className="chat-composer-input"
          placeholder={isListening
            ? (lang === 'id' ? 'Mendengarkan…' : 'Listening…')
            : (lang === 'id' ? 'Ketik atau ucapkan pesan dalam bahasa Jepang…' : 'Type or say a message in Japanese…')}
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
          title={lang === 'id' ? 'Kirim' : 'Send'}
        >
          <Send size={18} />
        </button>
      </div>

      {showConfirmEnd && (
        <div className="dialog-overlay" onClick={() => setShowConfirmEnd(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog-title">{lang === 'id' ? 'Akhiri Percakapan?' : 'End Conversation?'}</h3>
            <p className="dialog-text">
              {lang === 'id'
                ? `Anda sudah mengirim ${userMessageCount} pesan. Percakapan akan disimpan ke riwayat.`
                : `You've sent ${userMessageCount} message(s). The conversation will be saved to your history.`}
            </p>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirmEnd(false)}>
                {lang === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button className="btn btn-primary" onClick={handleEnd}>
                {lang === 'id' ? 'Akhiri' : 'End'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
