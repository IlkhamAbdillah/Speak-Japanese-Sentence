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

export function startRecognition(callbacks: SpeechCallbacks): boolean {
  const SpeechRecognitionClass = getSpeechRecognitionClass();
  if (!SpeechRecognitionClass) return false;

  stopRecognition();

  recognition = new SpeechRecognitionClass();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'ja-JP';

  recognition.onstart = () => {
    isListening = true;
    callbacks.onStart?.();
  };

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      } else {
        interimTranscript += result[0].transcript;
      }
    }

    if (finalTranscript) {
      callbacks.onFinalResult?.(finalTranscript);
    } else if (interimTranscript) {
      callbacks.onInterimResult?.(interimTranscript);
    }
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
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

  recognition.onend = () => {
    isListening = false;
    callbacks.onEnd?.();
  };

  try {
    recognition.start();
    return true;
  } catch {
    return false;
  }
}

export function stopRecognition(): void {
  if (recognition) {
    try {
      recognition.abort();
    } catch {
      // ignore
    }
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.onstart = null;
    recognition = null;
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
