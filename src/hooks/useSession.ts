import { useState, useCallback, useRef } from 'react';
import type {
  Session,
  Question,
  QuestionResult,
  Attempt,
  UserSettings,
  EvaluationResponse,
} from '../types';
import { isSingleAttemptMode, isKanjiMode, isMultipleChoiceMode } from '../types';
import { saveSession } from '../services/storage';
import { generateQuestions, evaluateAnswer, aiConfigFromSettings } from '../services/ai';
import type { QuestionSetKind } from '../services/ai';
import {
  startRecognition,
  stopRecognition,
  isSpeechRecognitionSupported,
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
  startListening: () => void;
  stopListening: () => void;
  submitTranscript: (transcript: string) => Promise<void>;
  /** Answer a multiple-choice question with the index of the chosen option */
  submitChoice: (choiceIndex: number) => void;
  nextQuestion: () => void;
  retryQuestion: () => void;
  revealAnswer: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
  isPaused: boolean;
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
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const settingsRef = useRef<UserSettings | null>(null);
  const sessionRef = useRef<Session | null>(null);

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
        setCurrentAttempts([]);
        setLastEvaluation(null);
        setFinalTranscript('');
        setInterimTranscript('');
        setSpeechState('idle');
        resetTimer();
        startTimer();
      } catch (err) {
        setGenerationError(
          err instanceof Error ? err.message : 'Failed to generate questions'
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [resetTimer, startTimer]
  );

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
      onEnd: () => {
        // Only change to idle if we weren't processing
        setSpeechState((prev) =>
          prev === 'listening' ? 'idle' : prev
        );
      },
    }, {
      // A kanji reading is a single word: submit as soon as it's recognised
      waitForSilence: !(settingsRef.current && isKanjiMode(settingsRef.current)),
    });

    if (!started) {
      setSpeechState('error');
      setEvaluationError('Failed to start speech recognition.');
    }
  }, []);

  // Stop button: cancel the recording and discard what was heard
  const stopListeningFn = useCallback(() => {
    stopRecognition();
    setInterimTranscript('');
    setSpeechState((prev) => (prev === 'listening' ? 'idle' : prev));
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

      try {
        const attemptNumber = currentAttempts.length + 1;

        const result = await evaluateAnswer(
          aiConfigFromSettings(settings),
          question,
          transcript,
          currentAttempts,
          attemptNumber,
          getMaxAttempts(settings),
          isSingleAttemptMode(settings)
        );

        setLastEvaluation(result);

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

        setCurrentAttempts((prev) => [...prev, attempt]);
        setSpeechState(result.correct ? 'correct' : 'retry');
      } catch (err) {
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
      revealedAnswer: lastEvaluation?.nextAction === 'reveal_answer',
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
    setInterimTranscript('');
    setSpeechState('idle');
    setLastEvaluation((prev) => prev
      ? { ...prev, nextAction: 'reveal_answer', hint: null }
      : {
          correct: false,
          transcript: '',
          feedback: '',
          grammarNotes: [],
          vocabularyNotes: [],
          hint: null,
          nextAction: 'reveal_answer',
        });
  }, []);

  // Pause / Resume
  const pauseSession = useCallback(() => {
    setIsPaused(true);
    stopTimer();
    stopRecognition();
    setSpeechState('idle');
  }, [stopTimer]);

  const resumeSession = useCallback(() => {
    setIsPaused(false);
    startTimer();
  }, [startTimer]);

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
    startListening,
    stopListening: stopListeningFn,
    submitTranscript,
    submitChoice,
    nextQuestion,
    retryQuestion,
    revealAnswer,
    pauseSession,
    resumeSession,
    endSession,
    isPaused,
  };
}
