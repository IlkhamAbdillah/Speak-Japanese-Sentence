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
// Delivers the running recognition's text (see finishRecognition)
let finishCurrent: (() => void) | null = null;

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

/**
 * Phones get push-to-talk (hold the mic, release to finish): their browsers end and
 * restart recognition after every phrase, so waiting for silence there is unreliable.
 * A touch screen as the main pointer is the sign of a phone or tablet.
 */
export function prefersPushToTalk(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
}

/** After push-to-talk is released, how long to wait for the browser's last result. */
const RELEASE_GRACE_MS = 1500;

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
  /**
   * Keep listening through any pause and never deliver on its own: the user ends it
   * with stopRecognition() (discard) or finishRecognition() (deliver, push-to-talk).
   */
  untilStopped?: boolean;
  /**
   * With waitForSilence false: a final result for which this returns true is not
   * delivered yet, e.g. 「それは」 said before the answer word itself.
   */
  isIncomplete?: (text: string) => boolean;
}

/** Errors after which the browser won't recognise anything, so restarting is pointless. */
const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported']);

/**
 * Join the results of a continuous session into one text. Chrome (especially on
 * Android) often repeats earlier speech in later results: either the whole text so
 * far again ("こんにち", "こんにちは") or the same segment twice. Plain concatenation
 * turned one spoken word into "こんにちこんにちは", which was then graded wrong.
 */
function mergeSegments(segments: string[]): string {
  let text = '';
  for (const raw of segments) {
    const seg = raw.trim();
    if (!seg) continue;
    if (seg.startsWith(text)) text = seg; // cumulative result: it already contains everything so far
    else if (!text.endsWith(seg)) text += seg; // otherwise skip an exact repeat of the last part
  }
  return text;
}

/** Start listening. Interim results carry the full text heard so far. */
export function startRecognition(
  callbacks: SpeechCallbacks,
  { waitForSilence = true, untilStopped = false, isIncomplete }: RecognitionOptions = {}
): boolean {
  const SpeechRecognitionClass = getSpeechRecognitionClass();
  if (!SpeechRecognitionClass) return false;

  stopRecognition();

  const rec = new SpeechRecognitionClass();
  recognition = rec;
  rec.continuous = waitForSilence || untilStopped;
  rec.interimResults = true;
  rec.lang = 'ja-JP';

  // The browser ends a recognition session on its own after a pause (Chrome on
  // Android after every phrase, desktop Chrome on silence or after about a minute).
  // We restart it then, so only our silence timer or the user decides when to stop.
  // Segments from the earlier browser sessions are kept here.
  const earlierSegments: string[] = [];
  let currentSegments: string[] = [];
  let heard = '';
  let finished = false;
  let releasing = false;
  let releaseTimer: ReturnType<typeof setTimeout> | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;

  const clearSilenceTimer = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = null;
  };

  const restartSilenceTimer = () => {
    clearSilenceTimer();
    silenceTimer = setTimeout(finish, SILENCE_SUBMIT_MS);
  };

  // Deliver what was heard (if anything) exactly once, then shut down
  function finish() {
    if (finished) return;
    finished = true;
    clearSilenceTimer();
    if (releaseTimer) clearTimeout(releaseTimer);
    // Cancelled (or replaced by a new session) in the meantime: deliver nothing
    if (recognition !== rec) return;
    const text = heard.trim();
    stopRecognition();
    if (text) callbacks.onFinalResult?.(text);
    else callbacks.onEnd?.();
  }

  // Push-to-talk released: let the browser finalise what it heard, then deliver
  finishCurrent = () => {
    if (finished || releasing) return;
    releasing = true;
    clearSilenceTimer();
    releaseTimer = setTimeout(finish, RELEASE_GRACE_MS);
    try {
      rec.stop();
    } catch {
      finish();
    }
  };

  rec.onstart = () => {
    // Released while a restart was still starting up: there is nothing more to hear
    if (releasing) {
      finish();
      return;
    }
    if (isListening) return; // a restart, not a new start
    isListening = true;
    callbacks.onStart?.();
  };

  rec.onresult = (event: SpeechRecognitionEvent) => {
    // In continuous mode event.results holds the whole browser session, so rebuild from the start
    const segments: string[] = [];
    let hasFinal = false;
    for (let i = 0; i < event.results.length; i++) {
      segments.push(event.results[i][0].transcript);
      hasFinal ||= event.results[i].isFinal;
    }
    currentSegments = segments;
    heard = mergeSegments([...earlierSegments, ...segments]);
    callbacks.onInterimResult?.(heard);

    if (untilStopped || releasing) return;
    if (!waitForSilence) {
      if (!hasFinal) return;
      if (isIncomplete?.(heard)) restartSilenceTimer(); // wait for the rest, but not forever
      else finish();
      return;
    }
    restartSilenceTimer();
  };

  rec.onerror = (event: SpeechRecognitionErrorEvent) => {
    // "no-speech" and the like just end this browser session; onend restarts it if needed
    if (!FATAL_ERRORS.has(event.error) && (untilStopped || releasing || heard.trim())) return;
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

  rec.onend = () => {
    if (finished) return;
    const keepListening = !releasing &&
      (untilStopped || (heard.trim() !== '' && (waitForSilence || !!isIncomplete?.(heard))));
    if (keepListening) {
      earlierSegments.push(...currentSegments);
      currentSegments = [];
      try {
        rec.start();
        return;
      } catch {
        // fall through and deliver what we have
      }
    }
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
  finishCurrent = null;
  if (recognition) {
    const rec = recognition;
    recognition = null;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    // A start() still in progress can ignore abort() (Chrome on Android), and the mic
    // would then come back on after the answer was submitted. Abort it once it starts.
    rec.onstart = () => {
      try {
        rec.abort();
      } catch {
        // ignore
      }
    };
    try {
      rec.abort();
    } catch {
      // ignore
    }
    isListening = false;
  }
}

/** Stop listening and deliver what was heard (push-to-talk released). */
export function finishRecognition(): void {
  finishCurrent?.();
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
