import { useState, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import type { UserSettings, MicPermission, Session, AppMode, Question, StoryInfo } from './types';
import { isConversationMode, hasAISetup } from './types';
import type { PresetQuestions } from './hooks/useSession';
import type { MistakeGroup, MistakePracticeMode } from './services/mistakes';
import { practiceQuestions } from './services/mistakes';
import { loadSettings, saveSettings, clearActiveSession, loadSavedSession, discardActiveSession } from './services/storage';
import { LanguageContext } from './i18n';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import PracticePage from './pages/PracticePage';
import ConversationPage from './pages/ConversationPage';
import RecapPage from './pages/RecapPage';
import MistakesPage from './pages/MistakesPage';
import WordsPage from './pages/WordsPage';
import ModePage from './pages/ModePage';

// The kanji details (readings, meanings of 2,000+ kanji) load only when the page is opened
const KanjiPage = lazy(() => import('./pages/KanjiPage'));
// The grammar list (400+ points with examples) too
const GrammarPage = lazy(() => import('./pages/GrammarPage'));
// The particle list and practice (shares the grammar data module)
const ParticlesPage = lazy(() => import('./pages/ParticlesPage'));
// How the app works (not linked from the menus)
const DocsPage = lazy(() => import('./pages/DocsPage'));
const DailyPage = lazy(() => import('./pages/DailyPage'));

function AppInner() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [micPermission, setMicPermission] = useState<MicPermission>('not-requested');
  // Continue the saved session in progress instead of starting a new one
  const [resuming, setResuming] = useState(false);
  const [practiceActive, setPracticeActive] = useState(false);
  // A session left in progress (tab closed, page reloaded): Home and its mode page offer to continue it
  const [savedSession, setSavedSession] = useState<Session | null>(() => loadSavedSession());
  const [recapSessionId, setRecapSessionId] = useState<string | null>(null);
  // Questions to practise again (Retry Wrong Answers) instead of generating new ones
  const [preset, setPreset] = useState<PresetQuestions | null>(null);

  const handleSettingsChange = useCallback((newSettings: UserSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  const handleStartPractice = useCallback(() => {
    clearActiveSession();
    setSavedSession(null);
    setResuming(false);
    setPreset(null);
    setPracticeActive(true);
    setRecapSessionId(null);
  }, []);

  const handleFinishPractice = useCallback(
    (sessionId: string) => {
      setPracticeActive(false);
      setSavedSession(loadSavedSession());
      setRecapSessionId(sessionId);
      navigate(`/recap/${sessionId}`);
    },
    [navigate]
  );

  // Back to the page of the mode that was being practised
  const handleExitPractice = useCallback(() => {
    setPracticeActive(false);
    setSavedSession(loadSavedSession());
    navigate(settings.appMode === 'jlpt' ? '/jlpt' : '/practice');
  }, [navigate, settings.appMode]);

  // An AI error during practice: leave it for Settings, which comes back to the mode's page
  // (the session stays saved, so the Continue card offers it again)
  const handleOpenSettings = useCallback(() => {
    setPracticeActive(false);
    setSavedSession(loadSavedSession());
    navigate('/settings', { state: { from: settings.appMode === 'jlpt' ? '/jlpt' : '/practice' } });
  }, [navigate, settings.appMode]);

  const handlePracticeAgain = useCallback(() => {
    clearActiveSession();
    setSavedSession(null);
    setResuming(false);
    setPreset(null);
    setPracticeActive(true);
    setRecapSessionId(null);
  }, []);

  // Practise saved questions again in their mode, without generating new ones
  const practiseAgain = useCallback((mode: MistakePracticeMode, questions: Question[], story?: StoryInfo) => {
    if (questions.length === 0) return;
    handleSettingsChange({
      ...settings,
      appMode: mode.appMode,
      exerciseMode: mode.exerciseMode,
      jlptSection: mode.jlptSection ?? settings.jlptSection,
      jlptLevel: mode.jlptLevel,
      // Only translation has a format; keep the learner's choice for the other modes
      translationFormat: mode.appMode === 'practice' && mode.exerciseMode === 'translation'
        ? (story ? 'story' : 'sentences')
        : settings.translationFormat,
    });
    clearActiveSession();
    setSavedSession(null);
    setResuming(false);
    setPreset({ questions, story });
    setPracticeActive(true);
    setRecapSessionId(null);
  }, [settings, handleSettingsChange]);

  // Continue the saved session: switch to its mode, then the practice page restores it
  const handleContinueSession = useCallback(() => {
    if (!savedSession) return;
    const appMode = savedSession.appMode as AppMode;
    handleSettingsChange({
      ...settings,
      appMode,
      exerciseMode: savedSession.mode,
      jlptSection: savedSession.jlptSection ?? settings.jlptSection,
      jlptLevel: savedSession.jlptLevel,
      translationFormat: appMode === 'practice' && savedSession.mode === 'translation'
        ? (savedSession.story ? 'story' : 'sentences')
        : settings.translationFormat,
    });
    navigate(appMode === 'jlpt' ? '/jlpt' : '/practice');
    setSavedSession(null);
    setResuming(true);
    setPreset(null);
    setPracticeActive(true);
    setRecapSessionId(null);
  }, [savedSession, settings, handleSettingsChange, navigate]);

  const handleDiscardSession = useCallback(() => {
    discardActiveSession();
    setSavedSession(null);
  }, []);

  const continueCard = (mode?: AppMode) =>
    savedSession && (!mode || savedSession.appMode === mode)
      ? { session: savedSession, onContinue: handleContinueSession, onDiscard: handleDiscardSession }
      : undefined;

  // Recap: the wrong answers of that session
  const handleRetryWrong = useCallback((sess: Session) => {
    practiseAgain(
      { appMode: (sess.appMode ?? 'practice') as AppMode, exerciseMode: sess.mode, jlptSection: sess.jlptSection, jlptLevel: sess.jlptLevel },
      sess.results.filter((r) => !r.isCorrect).map((r) => r.question),
      sess.story
    );
  }, [practiseAgain]);

  // Mistakes page: one list (type, or one story)
  const handlePracticeMistakes = useCallback((group: MistakeGroup) => {
    practiseAgain(group.mode, practiceQuestions(group), group.story);
  }, [practiseAgain]);

  // While practice is active, show the practice page full-screen (no nav)
  if (practiceActive) {
    const isConversation = isConversationMode(settings);
    return (
      <LanguageContext value={settings.instructionLanguage}>
        <div className="app-layout">
          {isConversation ? (
            <ConversationPage
              settings={settings}
              resume={resuming}
              onFinish={handleFinishPractice}
              onExit={handleExitPractice}
              onOpenSettings={handleOpenSettings}
            />
          ) : (
            <PracticePage
              settings={settings}
              resume={resuming}
              preset={preset ?? undefined}
              onFinish={handleFinishPractice}
              onExit={handleExitPractice}
              onOpenSettings={handleOpenSettings}
            />
          )}
        </div>
      </LanguageContext>
    );
  }

  return (
    <LanguageContext value={settings.instructionLanguage}>
      <div className="app-layout">
        <Header
          micPermission={micPermission}
          onLanguageChange={(lang) => handleSettingsChange({ ...settings, instructionLanguage: lang })}
        />
        <Routes>
          <Route path="/" element={<HomePage savedSession={continueCard()} aiReady={hasAISetup(settings)} />} />
          <Route
            path="/practice"
            element={
              <ModePage
                mode="practice"
                settings={settings}
                savedSession={continueCard('practice')}
                micPermission={micPermission}
                onMicPermissionChange={setMicPermission}
                onSettingsChange={handleSettingsChange}
                onStartPractice={handleStartPractice}
              />
            }
          />
          <Route
            path="/jlpt"
            element={
              <ModePage
                mode="jlpt"
                settings={settings}
                savedSession={continueCard('jlpt')}
                micPermission={micPermission}
                onMicPermissionChange={setMicPermission}
                onSettingsChange={handleSettingsChange}
                onStartPractice={handleStartPractice}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <SettingsPage
                settings={settings}
                onSettingsChange={handleSettingsChange}
              />
            }
          />
          <Route
            path="/words"
            element={
              <WordsPage
                settings={settings}
                onSettingsChange={handleSettingsChange}
              />
            }
          />
          <Route
            path="/kanji"
            element={
              <Suspense fallback={null}>
                <KanjiPage
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                />
              </Suspense>
            }
          />
          <Route
            path="/grammar"
            element={
              <Suspense fallback={null}>
                <GrammarPage
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                />
              </Suspense>
            }
          />
          <Route
            path="/particles"
            element={
              <Suspense fallback={null}>
                <ParticlesPage
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                />
              </Suspense>
            }
          />
          <Route
            path="/daily"
            element={
              <Suspense fallback={null}>
                <DailyPage settings={settings} />
              </Suspense>
            }
          />
          <Route
            path="/mistakes"
            element={<MistakesPage onPractice={handlePracticeMistakes} />}
          />
          <Route
            path="/docs"
            element={
              <Suspense fallback={null}>
                <DocsPage />
              </Suspense>
            }
          />
          {/* The old History page became Mistakes */}
          <Route path="/history" element={<Navigate to="/mistakes" replace />} />
          <Route
            path="/recap/:sessionId"
            element={
              <RecapPage
                sessionId={recapSessionId ?? undefined}
                onPracticeAgain={handlePracticeAgain}
                onRetryWrong={handleRetryWrong}
              />
            }
          />
          {/* Every URL reaches the app (vercel.json rewrite); unknown ones go home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </LanguageContext>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
