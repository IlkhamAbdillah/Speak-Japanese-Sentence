import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ListX, Mic, Languages, ChevronDown, Check, Menu, Settings, X } from 'lucide-react';
import type { MicPermission } from '../types';
import type { InstructionLanguage } from '../i18n';
import { LANGUAGE_CODES, languageMeta, useI18n } from '../i18n';
import type { NavGroup, NavItem } from '../navigation';
import { NAV_GROUPS } from '../navigation';

interface HeaderProps {
  micPermission: MicPermission;
  onLanguageChange: (lang: InstructionLanguage) => void;
}

type OpenMenu = NavGroup['id'] | 'lang' | 'mobile' | null;

const isActive = (item: NavItem, path: string) => path === item.path || path.startsWith(`${item.path}/`);

/**
 * The header, grouped now that the app has many sections (the logo is Home):
 * laptops: Learn ▾ (Kotoba, Kanji, Bunpou, Particles) · Practice ▾ (Speaking, JLPT) ·
 * Mistakes · ⚙ Settings (the AI) · language ▾. Phones (< 768px): the logo and a ☰ button
 * opening one panel with every section, Mistakes, Settings and the language.
 */
export default function Header({ micPermission, onLanguageChange }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const { lang, t } = useI18n();
  const [open, setOpen] = useState<OpenMenu>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Close any menu on an outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (to: string) => {
    setOpen(null);
    navigate(to);
  };
  const toggle = (menu: OpenMenu) => setOpen((current) => (current === menu ? null : menu));

  const itemButton = (item: NavItem, className: string) => (
    <button
      key={item.path}
      className={`${className} ${isActive(item, path) ? 'active' : ''}`}
      onClick={() => go(item.path)}
      aria-current={isActive(item, path) ? 'page' : undefined}
    >
      <span className="nav-item-glyph" lang="ja" aria-hidden="true">{item.glyph}</span>
      <span>{t(item.label)}</span>
    </button>
  );

  const languageOptions = (className: string) => LANGUAGE_CODES.map((code) => (
    <button
      key={code}
      role="menuitemradio"
      aria-checked={code === lang}
      className={`${className} ${code === lang ? 'active' : ''}`}
      onClick={() => {
        onLanguageChange(code);
        setOpen(null);
      }}
    >
      <span>{languageMeta(code).label}</span>
      {code === lang && <Check size={14} />}
    </button>
  ));

  return (
    <header className="header" ref={headerRef}>
      <button className="header-logo" onClick={() => go('/')} title={t('header.home')}>
        <span className="logo-jp">話</span>
        <span>SpeakJP</span>
      </button>

      {/* Laptops */}
      <nav className="header-nav">
        {NAV_GROUPS.map((group) => {
          const groupActive = group.items.some((item) => isActive(item, path));
          return (
            <div key={group.id} className="nav-dropdown">
              <button
                className={`header-nav-link ${groupActive ? 'active' : ''} ${open === group.id ? 'open' : ''}`}
                onClick={() => toggle(group.id)}
                aria-haspopup="menu"
                aria-expanded={open === group.id}
              >
                {t(group.label)}
                <ChevronDown size={14} className="nav-dropdown-chevron" />
              </button>
              {open === group.id && (
                <div className="nav-menu" role="menu">
                  {group.items.map((item) => itemButton(item, 'nav-menu-item'))}
                </div>
              )}
            </div>
          );
        })}

        <button
          className={`header-nav-link ${path === '/mistakes' ? 'active' : ''}`}
          onClick={() => go('/mistakes')}
        >
          <ListX size={16} />
          {t('header.mistakes')}
        </button>
      </nav>

      <div className="header-end">
        {micPermission === 'granted' && (
          <span className="mic-status granted" title={t('header.micReady')}>
            <Mic size={12} />
            <span className="header-nav-label">{t('header.micReady')}</span>
          </span>
        )}

        <button
          className={`header-nav-link header-settings ${path === '/settings' ? 'active' : ''}`}
          onClick={() => go('/settings')}
          title={t('header.settings')}
        >
          <Settings size={16} />
          <span className="header-nav-label">{t('header.settings')}</span>
        </button>

        <div className="nav-dropdown header-lang">
          <button
            className={`header-nav-link ${open === 'lang' ? 'open' : ''}`}
            onClick={() => toggle('lang')}
            aria-haspopup="menu"
            aria-expanded={open === 'lang'}
            title={t('header.language')}
          >
            <Languages size={16} />
            {lang.toUpperCase()}
            <ChevronDown size={14} className="nav-dropdown-chevron" />
          </button>
          {open === 'lang' && (
            <div className="nav-menu nav-menu-end lang-menu" role="menu">
              {languageOptions('lang-menu-item')}
            </div>
          )}
        </div>

        {/* Phones */}
        <button
          className={`header-nav-link header-menu-button ${open === 'mobile' ? 'open' : ''}`}
          onClick={() => toggle('mobile')}
          aria-expanded={open === 'mobile'}
          aria-label={t('header.menu')}
        >
          {open === 'mobile' ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open === 'mobile' && (
        <>
          <div className="mobile-nav-backdrop" onClick={() => setOpen(null)} />
          <nav className="mobile-nav">
            {NAV_GROUPS.map((group) => (
              <section key={group.id} className="mobile-nav-group">
                <h2 className="mobile-nav-title">{t(group.label)}</h2>
                <div className="mobile-nav-grid">
                  {group.items.map((item) => itemButton(item, 'mobile-nav-item'))}
                </div>
              </section>
            ))}
            <section className="mobile-nav-group">
              <h2 className="mobile-nav-title">{t('header.more')}</h2>
              <div className="mobile-nav-grid">
                <button
                  className={`mobile-nav-item ${path === '/mistakes' ? 'active' : ''}`}
                  onClick={() => go('/mistakes')}
                >
                  <span className="nav-item-glyph"><ListX size={18} /></span>
                  <span>{t('header.mistakes')}</span>
                </button>
                <button
                  className={`mobile-nav-item ${path === '/settings' ? 'active' : ''}`}
                  onClick={() => go('/settings')}
                >
                  <span className="nav-item-glyph"><Settings size={18} /></span>
                  <span>{t('header.settings')}</span>
                </button>
              </div>
            </section>
            <section className="mobile-nav-group">
              <h2 className="mobile-nav-title">{t('header.language')}</h2>
              <div className="mobile-nav-langs" role="menu">
                {languageOptions('mobile-nav-lang')}
              </div>
            </section>
          </nav>
        </>
      )}
    </header>
  );
}
