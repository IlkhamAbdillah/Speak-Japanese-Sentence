import { useState, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import type { UserSettings, MicPermission, Session, AppMode, Question, StoryInfo } from './types';
import { isConversationMode } from './types';
import type { PresetQuestions } from './hooks/useSession';
import type { MistakeGroup, MistakePracticeMode } from './services/mistakes';
import { practiceQuestions } from './services/mistakes';
import { loadSettings, saveSettings, loadActiveSession, clearActiveSession } from './services/storage';
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

function AppInner() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [micPermission, setMicPermission] = useState<MicPermission>('not-requested');
  // A session still in progress when the page was reloaded is continued
  const [resuming, setResuming] = useState(() => loadActiveSession(settings) !== null);
  const [practiceActive, setPracticeActive] = useState(resuming);
  const [recapSessionId, setRecapSessionId] = useState<string | null>(null);
  // Questions to practise again (Retry Wrong Answers) instead of generating new ones
  const [preset, setPreset] = useState<PresetQuestions | null>(null);

  const handleSettingsChange = useCallback((newSettings: UserSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  const handleStartPractice = useCallback(() => {
    clearActiveSession();
    setResuming(false);
    setPreset(null);
    setPracticeActive(true);
    setRecapSessionId(null);
  }, []);

  const handleFinishPractice = useCallback(
    (sessionId: string) => {
      setPracticeActive(false);
      setRecapSessionId(sessionId);
      navigate(`/recap/${sessionId}`);
    },
    [navigate]
  );

  // Back to the page of the mode that was being practised
  const handleExitPractice = useCallback(() => {
    setPracticeActive(false);
    navigate(settings.appMode === 'jlpt' ? '/jlpt' : '/practice');
  }, [navigate, settings.appMode]);

  const handlePracticeAgain = useCallback(() => {
    clearActiveSession();
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
    setResuming(false);
    setPreset({ questions, story });
    setPracticeActive(true);
    setRecapSessionId(null);
  }, [settings, handleSettingsChange]);

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
            />
          ) : (
            <PracticePage
              settings={settings}
              resume={resuming}
              preset={preset ?? undefined}
              onFinish={handleFinishPractice}
              onExit={handleExitPractice}
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
          <Route path="/" element={<HomePage />} />
          <Route
            path="/practice"
            element={
              <ModePage
                mode="practice"
                settings={settings}
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
            path="/mistakes"
            element={<MistakesPage onPractice={handlePracticeMistakes} />}
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
