import { useLocation, useNavigate } from 'react-router-dom';
import { Home, History, Settings, Mic } from 'lucide-react';
import type { MicPermission } from '../types';
import { useI18n } from '../i18n';

interface HeaderProps {
  micPermission: MicPermission;
}

export default function Header({ micPermission }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const { t } = useI18n();

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
            {t('header.micReady')}
          </span>
        )}

        <button
          className={`header-nav-link ${path === '/' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          <Home size={16} />
          {t('header.home')}
        </button>

        <button
          className={`header-nav-link ${path === '/history' ? 'active' : ''}`}
          onClick={() => navigate('/history')}
        >
          <History size={16} />
          {t('header.history')}
        </button>

        <button
          className={`header-nav-link ${path === '/settings' ? 'active' : ''}`}
          onClick={() => navigate('/settings')}
        >
          <Settings size={16} />
          {t('header.settings')}
        </button>
      </nav>
    </header>
  );
}
