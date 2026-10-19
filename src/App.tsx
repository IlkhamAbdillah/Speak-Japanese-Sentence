import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import type { UserSettings, MicPermission } from './types';
import { isConversationMode } from './types';
import { loadSettings, saveSettings, loadActiveSession, clearActiveSession } from './services/storage';
import { LanguageContext } from './i18n';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import PracticePage from './pages/PracticePage';
import ConversationPage from './pages/ConversationPage';
import RecapPage from './pages/RecapPage';
import HistoryPage from './pages/HistoryPage';

function AppInner() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [micPermission, setMicPermission] = useState<MicPermission>('not-requested');
  // A session still in progress when the page was reloaded is continued
  const [resuming, setResuming] = useState(() => loadActiveSession(settings) !== null);
  const [practiceActive, setPracticeActive] = useState(resuming);
  const [recapSessionId, setRecapSessionId] = useState<string | null>(null);

  const handleSettingsChange = useCallback((newSettings: UserSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  const handleStartPractice = useCallback(() => {
    clearActiveSession();
    setResuming(false);
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

  const handleExitPractice = useCallback(() => {
    setPracticeActive(false);
    navigate('/');
  }, [navigate]);

  const handlePracticeAgain = useCallback(() => {
    clearActiveSession();
    setResuming(false);
    setPracticeActive(true);
    setRecapSessionId(null);
  }, []);

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
          <Route
            path="/"
            element={
              <HomePage
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
            path="/history"
            element={<HistoryPage />}
          />
          <Route
            path="/recap/:sessionId"
            element={
              <RecapPage
                sessionId={recapSessionId ?? undefined}
                onPracticeAgain={handlePracticeAgain}
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
