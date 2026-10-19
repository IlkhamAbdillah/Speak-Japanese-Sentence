import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  Session,
  Question,
  QuestionResult,
  Attempt,
  UserSettings,
  EvaluationResponse,
} from '../types';
import { isSingleAttemptMode, isKanjiMode, isMultipleChoiceMode } from '../types';
import { saveSession, saveActiveSession, clearActiveSession } from '../services/storage';
import type { ActiveSession } from '../services/storage';
import { generateQuestions, evaluateAnswer, aiConfigFromSettings, isIncompleteKanjiAnswer } from '../services/ai';
import type { QuestionSetKind } from '../services/ai';
import {
  startRecognition,
  stopRecognition,
  finishRecognition,
  isSpeechRecognitionSupported,
  prefersPushToTalk,
} from '../services/speech';
import type { SpeechState } from '../types';

interface UseSessionReturn {
  session: Session | null;
  speechState: SpeechState;
  interimTranscript: string;
  finalTranscript: string;
  currentQuestion: Question | null;
  currentAttempts: Attempt[];
  lastEvaluation: EvaluationResponse | null;
  isGenerating: boolean;
  generationError: string | null;
  evaluationError: string | null;
  elapsedMs: number;
  startSession: (settings: UserSettings) => Promise<void>;
  /** Continue a session saved before the page was reloaded */
  restoreSession: (settings: UserSettings, saved: ActiveSession) => void;
  startListening: () => void;
  stopListening: () => void;
  /** Push-to-talk released: submit what was heard */
  releaseListening: () => void;
  submitTranscript: (transcript: string) => Promise<void>;
  /** Answer a multiple-choice question with the index of the chosen option */
  submitChoice: (choiceIndex: number) => void;
  nextQuestion: () => void;
  retryQuestion: () => void;
  /**
   * Show the expected answer, also before answering or while the AI is still
   * evaluating. Kanji: gives up the question. Translation/situation: Try Again
   * stays possible while attempts remain; moving on counts it as wrong.
   */
  revealAnswer: () => void;
  /** The expected answer is on screen */
  answerShown: boolean;
  endSession: () => void;
  /** Push-to-talk: the phone stopped listening while the mic is still held */
  micStopped: boolean;
}

/** Attempts allowed per question — a multiple-choice question only gets one. */
export function getMaxAttempts(settings: UserSettings): number {
  return isMultipleChoiceMode(settings) ? 1 : settings.maxAttempts;
}

export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [speechState, setSpeechState] = useState<SpeechState>('idle');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [currentAttempts, setCurrentAttempts] = useState<Attempt[]>([]);
  const [lastEvaluation, setLastEvaluation] = useState<EvaluationResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [micStopped, setMicStopped] = useState(false);
  const [answerShown, setAnswerShown] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const settingsRef = useRef<UserSettings | null>(null);
  const sessionRef = useRef<Session | null>(null);
  // Id of the latest startSession call. A slower, older generation request must not
  // replace a session the user has already started answering (it would jump back to question 1).
  const generationIdRef = useRef(0);
  // Id of the evaluation the UI is waiting for; revealing the answer bumps it so a
  // result that arrives afterwards is dropped.
  const evaluationIdRef = useRef(0);
  // The answer was shown at some point for the current question (kept through retries)
  const revealedRef = useRef(false);

  // Keep sessionRef in sync
  const updateSession = useCallback((updater: (prev: Session) => Session) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      sessionRef.current = updated;
      return updated;
    });
  }, []);

  // Timer management
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    stopTimer();
    setElapsedMs(0);
    startTimeRef.current = 0;
  }, [stopTimer]);

  // Current question
  const currentQuestion =
    session && session.currentQuestionIndex < session.questions.length
      ? session.questions[session.currentQuestionIndex]
      : null;

  // Start session
  const startSession = useCallback(
    async (settings: UserSettings) => {
      const generationId = ++generationIdRef.current;
      settingsRef.current = settings;
      setIsGenerating(true);
      setGenerationError(null);

      try {
        const kind: QuestionSetKind =
          settings.appMode === 'jlpt'
            ? settings.jlptSection
            : (settings.exerciseMode === 'situation' ? 'situation' : 'translation');

        const questions = await generateQuestions(
          aiConfigFromSettings(settings),
          kind,
          settings.jlptLevel,
          settings.instructionLanguage,
          settings.questionCount
        );
        if (generationId !== generationIdRef.current) return;

        const newSession: Session = {
          sessionId: `session-${Date.now()}`,
          startedAt: Date.now(),
          endedAt: null,
          status: 'in-progress',
          appMode: settings.appMode,
          jlptSection: settings.appMode === 'jlpt' ? settings.jlptSection : undefined,
          mode: settings.exerciseMode,
          jlptLevel: settings.jlptLevel,
          instructionLanguage: settings.instructionLanguage,
          // Reading always has a fixed number of questions, and the AI may return fewer
          questionCount: questions.length,
          questions,
          results: [],
          currentQuestionIndex: 0,
        };

        sessionRef.current = newSession;
        setSession(newSession);
        revealedRef.current = false;
        setAnswerShown(false);
        setCurrentAttempts([]);
        setLastEvaluation(null);
        setFinalTranscript('');
        setInterimTranscript('');
        setSpeechState('idle');
        resetTimer();
        startTimer();
      } catch (err) {
        if (generationId !== generationIdRef.current) return;
        setGenerationError(
          err instanceof Error ? err.message : 'Failed to generate questions'
        );
      } finally {
        if (generationId === generationIdRef.current) setIsGenerating(false);
      }
    },
    [resetTimer, startTimer]
  );

  const restoreSession = useCallback(
    (settings: UserSettings, saved: ActiveSession) => {
      settingsRef.current = settings;
      sessionRef.current = saved.session;
      setSession(saved.session);
      setCurrentAttempts(saved.attempts);
      revealedRef.current = saved.answerRevealed ?? false;
      setAnswerShown(saved.answerShown ?? false);
      setLastEvaluation(saved.lastEvaluation);
      setSpeechState(saved.lastEvaluation ? (saved.lastEvaluation.correct ? 'correct' : 'retry') : 'idle');
      resetTimer();
      startTimer();
    },
    [resetTimer, startTimer]
  );

  // Keep the session in progress in storage so a reload can continue it
  useEffect(() => {
    if (session?.status === 'in-progress') {
      saveActiveSession({
        session,
        attempts: currentAttempts,
        lastEvaluation,
        answerShown,
        answerRevealed: revealedRef.current,
      });
    } else if (session) {
      clearActiveSession();
    }
  }, [session, currentAttempts, lastEvaluation, answerShown]);

  // Speech recognition
  const startListening = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      setSpeechState('unsupported');
      return;
    }

    setInterimTranscript('');
    setFinalTranscript('');
    setLastEvaluation(null);
    setEvaluationError(null);
    setSpeechState('listening');
    setMicStopped(false);

    const kanji = !!settingsRef.current && isKanjiMode(settingsRef.current);
    const started = startRecognition({
      onInterimResult: (transcript) => {
        setInterimTranscript(transcript);
      },
      onFinalResult: (transcript) => {
        setFinalTranscript(transcript);
        setInterimTranscript('');
        setSpeechState('processing');
      },
      onError: (error) => {
        setSpeechState('error');
        setEvaluationError(error);
      },
      onStopped: () => setMicStopped(true),
      onEnd: () => {
        // Only change to idle if we weren't processing
        setSpeechState((prev) =>
          prev === 'listening' ? 'idle' : prev
        );
      },
    }, prefersPushToTalk()
      // Phone: push-to-talk, the answer is submitted when the mic is released
      ? { untilStopped: true, restartOnEnd: false }
      : kanji
      // A kanji reading is a single word: submit as soon as it's recognised,
      // unless only the start of 「それは … です」 has been said so far
      ? { waitForSilence: false, isIncomplete: isIncompleteKanjiAnswer }
      : { waitForSilence: true });

    if (!started) {
      setSpeechState('error');
      setEvaluationError('Failed to start speech recognition.');
    }
  }, []);

  // Stop button: cancel the recording and discard what was heard
  const stopListeningFn = useCallback(() => {
    stopRecognition();
    setMicStopped(false);
    setInterimTranscript('');
    setSpeechState((prev) => (prev === 'listening' ? 'idle' : prev));
  }, []);

  const releaseListening = useCallback(() => {
    finishRecognition();
    setMicStopped(false);
  }, []);

  // Submit transcript for evaluation
  const submitTranscript = useCallback(
    async (transcript: string) => {
      const settings = settingsRef.current;
      const sess = sessionRef.current;
      if (!settings || !sess) return;

      const question = sess.questions[sess.currentQuestionIndex];
      if (!question) return;

      setSpeechState('evaluating');
      setEvaluationError(null);
      const evaluationId = ++evaluationIdRef.current;
      const attemptNumber = currentAttempts.length + 1;

      try {
        const result = await evaluateAnswer(
          aiConfigFromSettings(settings),
          question,
          transcript,
          currentAttempts,
          attemptNumber,
          getMaxAttempts(settings),
          isSingleAttemptMode(settings)
        );

        const attempt: Attempt = {
          attemptNumber,
          transcript: result.transcript,
          isCorrect: result.correct,
          feedback: result.feedback,
          grammarNotes: result.grammarNotes,
          vocabularyNotes: result.vocabularyNotes,
          hint: result.hint,
          responseTimeMs: elapsedMs,
          timestamp: Date.now(),
        };

        // The answer was revealed while waiting: drop this result
        if (evaluationId !== evaluationIdRef.current) return;
        setLastEvaluation(result);
        setCurrentAttempts((prev) => [...prev, attempt]);
        setSpeechState(result.correct ? 'correct' : 'retry');
      } catch (err) {
        if (evaluationId !== evaluationIdRef.current) return;
        setSpeechState('error');
        setEvaluationError(
          err instanceof Error ? err.message : 'Evaluation failed'
        );
      }
    },
    [currentAttempts, elapsedMs]
  );

  // Next question
  const nextQuestion = useCallback(() => {
    const sess = sessionRef.current;
    if (!sess) return;
    const question = sess.questions[sess.currentQuestionIndex];
    if (!question) return;

    const questionResult: QuestionResult = {
      question,
      attempts: currentAttempts,
      isCorrect: currentAttempts.some((a) => a.isCorrect),
      totalTimeMs: elapsedMs,
      // Typed answers never set finalTranscript, so prefer the last attempt
      finalTranscript: currentAttempts[currentAttempts.length - 1]?.transcript ?? finalTranscript,
      revealedAnswer: revealedRef.current || lastEvaluation?.nextAction === 'reveal_answer',
    };

    const newIndex = sess.currentQuestionIndex + 1;
    const isFinished = newIndex >= sess.questions.length;

    updateSession((prev) => ({
      ...prev,
      results: [...prev.results, questionResult],
      currentQuestionIndex: newIndex,
      status: isFinished ? 'completed' : 'in-progress',
      endedAt: isFinished ? Date.now() : null,
    }));

    if (isFinished) {
      stopTimer();
      // Save completed session
      const finalSession: Session = {
        ...sess,
        results: [...sess.results, questionResult],
        currentQuestionIndex: newIndex,
        status: 'completed',
        endedAt: Date.now(),
      };
      saveSession(finalSession);
    } else {
      // Reset for next question
      revealedRef.current = false;
      setAnswerShown(false);
      setCurrentAttempts([]);
      setLastEvaluation(null);
      setFinalTranscript('');
      setInterimTranscript('');
      setSpeechState('idle');
      resetTimer();
      startTimer();
    }
  }, [currentAttempts, elapsedMs, finalTranscript, lastEvaluation, updateSession, stopTimer, resetTimer, startTimer]);

  // Retry
  const retryQuestion = useCallback(() => {
    setAnswerShown(false);
    setFinalTranscript('');
    setInterimTranscript('');
    setLastEvaluation(null);
    setEvaluationError(null);
    setSpeechState('idle');
  }, []);

  // Multiple choice (reading): checked locally, one attempt, no AI call
  const submitChoice = useCallback((choiceIndex: number) => {
    const question = sessionRef.current?.questions[sessionRef.current.currentQuestionIndex];
    if (!question?.choices || lastEvaluation) return;

    const correct = choiceIndex === question.correctChoice;
    const chosen = question.choices[choiceIndex] ?? '';
    setLastEvaluation({
      correct,
      transcript: chosen,
      feedback: question.explanation ?? '',
      grammarNotes: [],
      vocabularyNotes: [],
      hint: null,
      nextAction: correct ? 'next_question' : 'reveal_answer',
    });
    setCurrentAttempts([{
      attemptNumber: 1,
      transcript: chosen,
      isCorrect: correct,
      feedback: question.explanation ?? '',
      grammarNotes: [],
      vocabularyNotes: [],
      hint: null,
      responseTimeMs: elapsedMs,
      timestamp: Date.now(),
    }]);
    setSpeechState(correct ? 'correct' : 'retry');
  }, [lastEvaluation, elapsedMs]);

  // Give up on the question: show the answer and only allow moving on
  const revealAnswer = useCallback(() => {
    stopRecognition();
    evaluationIdRef.current++; // an evaluation still running is no longer wanted
    revealedRef.current = true;
    setAnswerShown(true);
    setInterimTranscript('');
    setEvaluationError(null);
    setSpeechState('idle');

    const settings = settingsRef.current;
    // Kanji: showing the reading means giving up, so only Next is offered
    const giveUp = !settings || isKanjiMode(settings);
    const attemptsLeft = !!settings && currentAttempts.length < getMaxAttempts(settings);
    setLastEvaluation((prev) => prev
      ? { ...prev, hint: null, nextAction: giveUp ? 'reveal_answer' : prev.nextAction }
      : {
          correct: false,
          transcript: '',
          feedback: '',
          grammarNotes: [],
          vocabularyNotes: [],
          hint: null,
          nextAction: !giveUp && attemptsLeft ? 'retry' : 'reveal_answer',
        });
  }, [currentAttempts]);

  // End session
  const endSession = useCallback(() => {
    stopTimer();
    stopRecognition();

    const sess = sessionRef.current;
    if (sess && sess.results.length > 0) {
      const finalSession: Session = {
        ...sess,
        status: 'abandoned',
        endedAt: Date.now(),
      };
      saveSession(finalSession);
      sessionRef.current = finalSession;
      setSession(finalSession);
    } else {
      setSession(null);
      sessionRef.current = null;
      clearActiveSession();
    }
  }, [stopTimer]);

  return {
    session,
    speechState,
    interimTranscript,
    finalTranscript,
    currentQuestion,
    currentAttempts,
    lastEvaluation,
    isGenerating,
    generationError,
    evaluationError,
    elapsedMs,
    startSession,
    restoreSession,
    startListening,
    stopListening: stopListeningFn,
    releaseListening,
    micStopped,
    submitTranscript,
    submitChoice,
    nextQuestion,
    retryQuestion,
    revealAnswer,
    answerShown,
    endSession,
  };
}
