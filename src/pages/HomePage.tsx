import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n';
import { DAILY_ITEM, NAV_ITEMS } from '../navigation';
import { loadDailyPlan, todayKey } from '../services/storage';
import { DAILY_PARTS } from '../types';
import ContinueSessionCard from '../components/ContinueSessionCard';
import type { ContinueSession } from '../components/ContinueSessionCard';

/** Landing page: the sections of the app. */
interface HomePageProps {
  savedSession?: ContinueSession;
  /** An AI is set up (Daily Learning's Bunpou and Particle parts need one) */
  aiReady: boolean;
}

export default function HomePage({ savedSession, aiReady }: HomePageProps) {
  const navigate = useNavigate();
  const { t } = useI18n();

  // Daily Learning: done for today turns its glyph green (no text under the label, user-requested)
  const plan = loadDailyPlan();
  const parts = aiReady ? DAILY_PARTS.length : 1;
  const done = plan?.date === todayKey() ? DAILY_PARTS.filter((p) => plan.done[p] && (aiReady || p === 'kanji')).length : 0;

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

      {/* The sections of the app: Daily Learning on its own row, then the rest (the odd last card spans the row) */}
      <div className="home-daily animate-in" style={{ animationDelay: '50ms' }}>
        <button className={`home-menu-card home-daily-card ${done >= parts ? 'done' : ''}`} onClick={() => navigate(DAILY_ITEM.path)}>
          <span className="home-menu-glyph" lang="ja" aria-hidden="true">{DAILY_ITEM.glyph}</span>
          <span className="home-menu-label">{t(DAILY_ITEM.label)}</span>
          <ChevronRight size={18} className="home-menu-chevron" />
        </button>
      </div>
      <nav className="home-menu animate-in" style={{ animationDelay: '100ms' }}>
        {NAV_ITEMS.filter((item) => item !== DAILY_ITEM).map((item) => (
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
