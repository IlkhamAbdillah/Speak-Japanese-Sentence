import { useState, useCallback, useRef, useEffect } from 'react';
import type { Session, UserSettings, ConversationMessage } from '../types';
import { saveSession, deleteSession } from '../services/storage';
import { getConversationReply, aiConfigFromSettings } from '../services/ai';
import { stopSpeaking } from '../services/speech';

interface UseConversationReturn {
  session: Session | null;
  messages: ConversationMessage[];
  isWaitingForAI: boolean;
  error: string | null;
  /** Start a new conversation; a null topic lets the AI pick one */
  start: (topic: string | null) => Promise<void>;
  send: (text: string) => Promise<void>;
  /** Retry the last AI request after an error */
  retry: () => Promise<void>;
  /** Finish the conversation. Returns the saved session id, or null if nothing was said. */
  end: () => string | null;
}

let messageCounter = 0;
const newMessageId = () => `m-${Date.now()}-${messageCounter++}`;

export function useConversation(settings: UserSettings): UseConversationReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [isWaitingForAI, setIsWaitingForAI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const commit = useCallback((next: Session) => {
    sessionRef.current = next;
    setSession(next);
    // Save every turn so the conversation survives a closed tab, but only once
    // the user has said something — an unanswered greeting isn't worth keeping
    if (next.conversation?.messages.some((m) => m.role === 'user')) saveSession(next);
  }, []);

  // Ask the AI for its next message based on the current history
  const requestReply = useCallback(async () => {
    const sess = sessionRef.current;
    if (!sess?.conversation) return;

    setIsWaitingForAI(true);
    setError(null);
    try {
      const history = sess.conversation.messages;
      const result = await getConversationReply(
        aiConfigFromSettings(settings),
        sess.jlptLevel,
        sess.instructionLanguage,
        sess.conversation.topic,
        history
      );

      // Re-read: the session may have changed while waiting
      const current = sessionRef.current;
      if (!current?.conversation) return;

      const messages = [...current.conversation.messages];
      const last = messages[messages.length - 1];
      if (last?.role === 'user') {
        messages[messages.length - 1] = { ...last, correction: result.correction };
      }
      messages.push({
        id: newMessageId(),
        role: 'ai',
        text: result.reply,
        translation: result.translation,
        timestamp: Date.now(),
      });

      commit({ ...current, conversation: { ...current.conversation, messages } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get a reply from the AI.');
    } finally {
      setIsWaitingForAI(false);
    }
  }, [settings, commit]);

  const start = useCallback(async (topic: string | null) => {
    const newSession: Session = {
      sessionId: `session-${Date.now()}`,
      startedAt: Date.now(),
      endedAt: null,
      status: 'in-progress',
      appMode: 'practice',
      mode: 'conversation',
      jlptLevel: settings.jlptLevel,
      instructionLanguage: settings.instructionLanguage,
      questionCount: 0,
      questions: [],
      results: [],
      currentQuestionIndex: 0,
      conversation: { topic, messages: [] },
    };
    sessionRef.current = newSession;
    setSession(newSession);
    await requestReply();
  }, [settings.jlptLevel, settings.instructionLanguage, requestReply]);

  const send = useCallback(async (text: string) => {
    const sess = sessionRef.current;
    const trimmed = text.trim();
    if (!sess?.conversation || !trimmed || isWaitingForAI) return;

    const message: ConversationMessage = {
      id: newMessageId(),
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };
    commit({
      ...sess,
      conversation: { ...sess.conversation, messages: [...sess.conversation.messages, message] },
    });
    await requestReply();
  }, [isWaitingForAI, commit, requestReply]);

  const end = useCallback((): string | null => {
    stopSpeaking();
    const sess = sessionRef.current;
    if (!sess) return null;

    const userMessages = sess.conversation?.messages.filter((m) => m.role === 'user').length ?? 0;
    if (userMessages === 0) {
      deleteSession(sess.sessionId);
      return null;
    }
    commit({ ...sess, status: 'completed', endedAt: Date.now() });
    return sess.sessionId;
  }, [commit]);

  // Stop any speech playback when leaving the page
  useEffect(() => () => stopSpeaking(), []);

  return {
    session,
    messages: session?.conversation?.messages ?? [],
    isWaitingForAI,
    error,
    start,
    send,
    retry: requestReply,
    end,
  };
}
