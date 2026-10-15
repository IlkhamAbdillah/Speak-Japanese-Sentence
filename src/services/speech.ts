import type { MicPermission } from '../types';

// ─── Browser API Types ──────────────────────────────────

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

// ─── Callbacks ──────────────────────────────────────────

export interface SpeechCallbacks {
  onInterimResult?: (transcript: string) => void;
  onFinalResult?: (transcript: string) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

// ─── Service ────────────────────────────────────────────

let recognition: SpeechRecognitionInstance | null = null;
let isListening = false;

function getSpeechRecognitionClass(): SpeechRecognitionConstructor | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as SpeechRecognitionConstructor | null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionClass() !== null;
}

export async function requestMicPermission(): Promise<MicPermission> {
  if (!isSpeechRecognitionSupported()) return 'unsupported';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop all tracks immediately — we just needed permission
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch (err) {
    const error = err as DOMException;
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'denied';
    }
    return 'error';
  }
}

/** How long the user may pause before their answer is submitted automatically. */
export const SILENCE_SUBMIT_MS = 3000;

export interface RecognitionOptions {
  /**
   * true (default): listen continuously and deliver the whole utterance once the
   * user has been silent for SILENCE_SUBMIT_MS, so a pause mid-sentence doesn't
   * submit a half-finished answer.
   * false: deliver the first final result right away — best for single words.
   */
  waitForSilence?: boolean;
}

/** Start listening. Interim results carry the full text heard so far. */
export function startRecognition(
  callbacks: SpeechCallbacks,
  { waitForSilence = true }: RecognitionOptions = {}
): boolean {
  const SpeechRecognitionClass = getSpeechRecognitionClass();
  if (!SpeechRecognitionClass) return false;

  stopRecognition();

  const rec = new SpeechRecognitionClass();
  recognition = rec;
  rec.continuous = waitForSilence;
  rec.interimResults = true;
  rec.lang = 'ja-JP';

  let heard = '';
  let finished = false;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;

  const clearSilenceTimer = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = null;
  };

  // Deliver what was heard (if anything) exactly once, then shut down
  const finish = () => {
    if (finished) return;
    finished = true;
    clearSilenceTimer();
    // Cancelled (or replaced by a new session) in the meantime: deliver nothing
    if (recognition !== rec) return;
    const text = heard.trim();
    stopRecognition();
    if (text) callbacks.onFinalResult?.(text);
    else callbacks.onEnd?.();
  };

  rec.onstart = () => {
    isListening = true;
    callbacks.onStart?.();
  };

  rec.onresult = (event: SpeechRecognitionEvent) => {
    // In continuous mode event.results holds the whole session, so rebuild from the start
    let text = '';
    let hasFinal = false;
    for (let i = 0; i < event.results.length; i++) {
      text += event.results[i][0].transcript;
      hasFinal ||= event.results[i].isFinal;
    }
    heard = text;
    callbacks.onInterimResult?.(text);

    if (!waitForSilence) {
      if (hasFinal) finish();
      return;
    }
    clearSilenceTimer();
    silenceTimer = setTimeout(finish, SILENCE_SUBMIT_MS);
  };

  rec.onerror = (event: SpeechRecognitionErrorEvent) => {
    // If we already heard something, submit it instead of failing
    if (heard.trim()) {
      finish();
      return;
    }
    finished = true;
    clearSilenceTimer();
    isListening = false;
    const errorMap: Record<string, string> = {
      'no-speech': 'No speech detected. Please try again.',
      'audio-capture': 'Microphone not available.',
      'not-allowed': 'Microphone permission denied.',
      network: 'Network error during speech recognition.',
      aborted: 'Speech recognition was cancelled.',
    };
    callbacks.onError?.(errorMap[event.error] ?? `Recognition error: ${event.error}`);
  };

  // The browser can end the session on its own (e.g. long silence); submit what we have
  rec.onend = () => {
    isListening = false;
    finish();
  };

  try {
    rec.start();
    return true;
  } catch {
    return false;
  }
}

/** Stop listening and throw away anything heard (the "cancel" button). */
export function stopRecognition(): void {
  if (recognition) {
    const rec = recognition;
    recognition = null;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    rec.onstart = null;
    try {
      rec.abort();
    } catch {
      // ignore
    }
    isListening = false;
  }
}

export function getIsListening(): boolean {
  return isListening;
}

// ─── Text to Speech ─────────────────────────────────────

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Read Japanese text aloud with the browser's built-in voice. */
export function speakJapanese(text: string): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('ja'));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}
