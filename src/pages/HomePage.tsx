import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { MessageKey } from '../i18n';
import { useI18n } from '../i18n';

// Landing page menu: one card per section of the app
const HOME_MENU: { path: string; glyph: string; label: MessageKey }[] = [
  { path: '/words', glyph: '語', label: 'home.menu.words' },
  { path: '/kanji', glyph: '字', label: 'home.menu.kanji' },
  { path: '/practice', glyph: '話', label: 'home.menu.practice' },
  { path: '/jlpt', glyph: '試', label: 'home.menu.jlpt' },
];

/** Landing page: the four sections of the app. */
export default function HomePage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="app-main">
      {/* Welcome */}
      <section className="welcome-section animate-in">
        <h1 className="welcome-title">
          {t('home.welcomeTitle')}
        </h1>
        <p className="welcome-subtitle">
          {t('home.welcomeSubtitle')}
        </p>
      </section>

      {/* The four sections of the app */}
      <nav className="home-menu animate-in" style={{ animationDelay: '100ms' }}>
        {HOME_MENU.map((item) => (
          <button key={item.path} className="home-menu-card" onClick={() => navigate(item.path)}>
            <span className="home-menu-glyph" lang="ja" aria-hidden="true">{item.glyph}</span>
            <span className="home-menu-label">{t(item.label)}</span>
            <ChevronRight size={18} className="home-menu-chevron" />
          </button>
        ))}
      </nav>
    </div>
  );
}
