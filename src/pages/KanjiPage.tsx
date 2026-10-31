import { useI18n } from '../i18n';

/** The kanji list. Empty for now: the data will be added later (like the Words page's lists). */
export default function KanjiPage() {
  const { t } = useI18n();
  return (
    <div className="app-main">
      <section className="welcome-section vocab-header animate-in">
        <h1 className="welcome-title">{t('kanjiList.title')}</h1>
        <p className="welcome-subtitle">{t('kanjiList.subtitle')}</p>
      </section>
      <section className="vocab-panel animate-in">
        <div className="empty-state">
          <div className="empty-state-icon" lang="ja">字</div>
          <p className="empty-state-title">{t('kanjiList.emptyTitle')}</p>
          <p className="empty-state-text">{t('kanjiList.emptyText')}</p>
        </div>
      </section>
    </div>
  );
}
