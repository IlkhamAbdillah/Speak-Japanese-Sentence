import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n';
import { NAV_ITEMS } from '../navigation';
import ContinueSessionCard from '../components/ContinueSessionCard';
import type { ContinueSession } from '../components/ContinueSessionCard';

/** Landing page: the sections of the app. */
export default function HomePage({ savedSession }: { savedSession?: ContinueSession }) {
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

      {savedSession && <ContinueSessionCard {...savedSession} />}

      {/* The sections of the app (the odd last card spans the row) */}
      <nav className="home-menu animate-in" style={{ animationDelay: '100ms' }}>
        {NAV_ITEMS.map((item) => (
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
