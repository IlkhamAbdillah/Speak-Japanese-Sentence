import { useState } from 'react';
import { Play } from 'lucide-react';
import type { Session } from '../types';
import { getSessionModeLabel } from '../types';
import { useI18n } from '../i18n';
import ConfirmDialog from './ConfirmDialog';

export interface ContinueSession {
  session: Session;
  onContinue: () => void;
  onDiscard: () => void;
}

/** A session left in progress (tab closed, page reloaded): Discard it or Continue where it was. */
export default function ContinueSessionCard({ session, onContinue, onDiscard }: ContinueSession) {
  const { t, lang } = useI18n();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const isConversation = !!session.conversation;
  const progress = isConversation
    ? t('home.continueMessages', {
        count: session.conversation?.messages.filter((m) => m.role === 'user').length ?? 0,
      })
    : t('practice.questionOf', {
        current: Math.min(session.currentQuestionIndex + 1, session.questions.length),
        total: session.questions.length,
      });
  const title = session.story?.title;

  return (
    <section className="continue-card animate-in">
      <div className="continue-card-text">
        <p className="continue-card-title">{t('home.continueTitle')}</p>
        <p className="continue-card-meta">
          {getSessionModeLabel(session, lang)}
          {title && <> · <span lang="ja">{title}</span></>}
          {' · '}{session.jlptLevel}
        </p>
        <p className="continue-card-meta">{progress}</p>
      </div>
      <div className="continue-card-actions">
        <button className="btn btn-secondary" onClick={() => setConfirmDiscard(true)}>
          {t('home.discard')}
        </button>
        <button className="btn btn-primary" onClick={onContinue}>
          <Play size={16} /> {t('home.continue')}
        </button>
      </div>

      {confirmDiscard && (
        <ConfirmDialog
          title={t('home.discardTitle')}
          text={isConversation
            ? t('home.discardConversation')
            : session.results.length > 0
              ? t('practice.endWithResults', { count: session.results.length })
              : t('practice.endWithoutResults')}
          confirmLabel={t('home.discard')}
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false);
            onDiscard();
          }}
        />
      )}
    </section>
  );
}
