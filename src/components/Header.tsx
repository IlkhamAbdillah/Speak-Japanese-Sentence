import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, History, BookA, Mic, Languages, ChevronDown, Check } from 'lucide-react';
import type { MicPermission } from '../types';
import type { InstructionLanguage } from '../i18n';
import { LANGUAGE_CODES, languageMeta, useI18n } from '../i18n';

interface HeaderProps {
  micPermission: MicPermission;
  onLanguageChange: (lang: InstructionLanguage) => void;
}

export default function Header({ micPermission, onLanguageChange }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const { lang, t } = useI18n();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Close the language menu on an outside click or Escape
  useEffect(() => {
    if (!langMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!langMenuRef.current?.contains(e.target as Node)) setLangMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLangMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [langMenuOpen]);

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
            <span className="header-nav-label">{t('header.micReady')}</span>
          </span>
        )}

        <button
          className={`header-nav-link ${path === '/' ? 'active' : ''}`}
          onClick={() => navigate('/')}
          title={t('header.home')}
        >
          <Home size={16} />
          <span className="header-nav-label">{t('header.home')}</span>
        </button>

        <button
          className={`header-nav-link ${path === '/words' ? 'active' : ''}`}
          onClick={() => navigate('/words')}
          title={t('words.navLabel')}
        >
          <BookA size={16} />
          <span className="header-nav-label">{t('words.navLabel')}</span>
        </button>

        <button
          className={`header-nav-link ${path === '/history' ? 'active' : ''}`}
          onClick={() => navigate('/history')}
          title={t('header.history')}
        >
          <History size={16} />
          <span className="header-nav-label">{t('header.history')}</span>
        </button>

        <div className="lang-switcher" ref={langMenuRef}>
          <button
            className={`header-nav-link ${langMenuOpen ? 'active' : ''}`}
            onClick={() => setLangMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={langMenuOpen}
            title={t('header.language')}
          >
            <Languages size={16} />
            {lang.toUpperCase()}
            <ChevronDown size={14} />
          </button>
          {langMenuOpen && (
            <div className="lang-menu" role="menu">
              {LANGUAGE_CODES.map((code) => (
                <button
                  key={code}
                  role="menuitemradio"
                  aria-checked={code === lang}
                  className={`lang-menu-item ${code === lang ? 'active' : ''}`}
                  onClick={() => {
                    onLanguageChange(code);
                    setLangMenuOpen(false);
                  }}
                >
                  <span>{languageMeta(code).label}</span>
                  {code === lang && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
