import { useLocation, useNavigate } from 'react-router-dom';
import { Home, History, Settings, Mic } from 'lucide-react';
import type { MicPermission } from '../types';

interface HeaderProps {
  micPermission: MicPermission;
}

export default function Header({ micPermission }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  return (
    <header className="header">
      <div className="header-logo" onClick={() => navigate('/')}>
        <span className="logo-jp">話</span>
        <span>SpeakJP</span>
      </div>

      <nav className="header-nav">
        {micPermission === 'granted' && (
          <span className="mic-status granted">
            <Mic size={12} />
            Ready
          </span>
        )}

        <button
          className={`header-nav-link ${path === '/' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          <Home size={16} />
          Home
        </button>

        <button
          className={`header-nav-link ${path === '/history' ? 'active' : ''}`}
          onClick={() => navigate('/history')}
        >
          <History size={16} />
          History
        </button>

        <button
          className={`header-nav-link ${path === '/settings' ? 'active' : ''}`}
          onClick={() => navigate('/settings')}
        >
          <Settings size={16} />
          Settings
        </button>
      </nav>
    </header>
  );
}
