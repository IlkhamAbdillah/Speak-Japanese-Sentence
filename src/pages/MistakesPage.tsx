import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListX, Play, Eye, Check, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import type { MessageKey } from '../i18n';
import { languageMeta, useI18n } from '../i18n';
import type { ConversationMistake, MistakeGroup, MistakeKind, QuestionMistake } from '../services/mistakes';
import { collectMistakes, practiceQuestions, MISTAKE_PRACTICE_LIMIT } from '../services/mistakes';
import { loadDismissedMistakes, loadSessions, saveDismissedMistakes } from '../services/storage';

interface MistakesPageProps {
  /** Practise a group's questions again (no AI generation call) */
  onPractice: (group: MistakeGroup) => void;
}

/** Rows shown per list before "Show all". */
const COLLAPSED_ROWS = 5;

const KIND_LABEL: Record<MistakeKind, MessageKey> = {
  translation: 'mistakes.kind.translation',
  situation: 'mistakes.kind.situation',
  story: 'mistakes.kind.story',
  kanji: 'mistakes.kind.kanji',
  reading: 'mistakes.kind.reading',
};

/**
 * What to study next: every question answered wrong, grouped by practice type,
 * with a button to practise them again. Answering one right removes it.
 */
export default function MistakesPage({ onPractice }: MistakesPageProps) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(loadDismissedMistakes);
  const [sessions] = useState(loadSessions);
  const { groups, conversation } = useMemo(() => collectMistakes(sessions, dismissed), [sessions, dismissed]);

  const dismiss = (key: string) => {
    const next = new Set(dismissed).add(key);
    saveDismissedMistakes(next);
    setDismissed(next);
  };

  const empty = groups.length === 0 && conversation.length === 0;

  return (
    <div className="app-main mistakes-page">
      <h1 className="mistakes-title">
        <ListX size={24} />
        {t('mistakes.title')}
      </h1>
      <p className="mistakes-intro">{t('mistakes.intro')}</p>

      {empty ? (
        <div className="empty-state">
          <div className="empty-state-icon">✨</div>
          <p className="empty-state-title">{t('mistakes.emptyTitle')}</p>
          <p className="empty-state-text">{t('mistakes.emptyText')}</p>
        </div>
      ) : (
        <>
          {groups.map((group) => (
            <MistakeSection
              key={group.id}
              title={group.story
                ? t('mistakes.storyTitle', { title: group.story.title })
                : t(KIND_LABEL[group.kind])}
              count={group.items.length}
              action={
                <button className="btn btn-primary btn-sm" onClick={() => onPractice(group)}>
                  <Play size={14} />
                  {t('mistakes.practice', { count: practiceQuestions(group).length })}
                </button>
              }
              note={group.kind !== 'story' && group.items.length > MISTAKE_PRACTICE_LIMIT
                ? t('mistakes.practiceNewest', { count: MISTAKE_PRACTICE_LIMIT })
                : undefined}
              rows={group.items.map((item) => (
                <QuestionRow key={item.key} item={item} onDismiss={() => dismiss(item.key)} />
              ))}
            />
          ))}

          {conversation.length > 0 && (
            <MistakeSection
              title={t('mistakes.kind.conversation')}
              count={conversation.length}
              rows={conversation.map((item) => (
                <ConversationRow key={item.key} item={item} onDismiss={() => dismiss(item.key)} />
              ))}
            />
          )}
        </>
      )}
    </div>
  );
}

function MistakeSection({ title, count, action, note, rows }: {
  title: string;
  count: number;
  action?: ReactNode;
  note?: string;
  rows: ReactNode[];
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);

  return (
    <section className="mistakes-group animate-in">
      <div className="mistakes-group-header">
        <h2 className="mistakes-group-title">
          {title}
          <span className="badge badge-error">{count}</span>
        </h2>
        {action}
      </div>
      {note && <p className="mistakes-group-note">{note}</p>}
      <div className="mistakes-list">{shown}</div>
      {rows.length > COLLAPSED_ROWS && (
        <button className="btn btn-ghost btn-sm mistakes-more" onClick={() => setExpanded((e) => !e)}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? t('mistakes.showLess') : t('mistakes.showAll', { count: rows.length })}
        </button>
      )}
    </section>
  );
}

function useFormatDate() {
  const { lang } = useI18n();
  return (ts: number) =>
    new Date(ts).toLocaleDateString(languageMeta(lang).locale, { month: 'short', day: 'numeric' });
}

function RowActions({ sessionId, onDismiss }: { sessionId: string; onDismiss: () => void }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <div className="mistake-actions">
      <button
        className="btn btn-ghost btn-sm btn-icon"
        onClick={() => navigate(`/recap/${sessionId}`)}
        title={t('mistakes.openSession')}
        aria-label={t('mistakes.openSession')}
      >
        <Eye size={16} />
      </button>
      <button
        className="btn btn-ghost btn-sm btn-icon"
        onClick={onDismiss}
        title={t('mistakes.dismiss')}
        aria-label={t('mistakes.dismiss')}
      >
        <Check size={16} />
      </button>
    </div>
  );
}

function QuestionRow({ item, onDismiss }: { item: QuestionMistake; onDismiss: () => void }) {
  const { t } = useI18n();
  const formatDate = useFormatDate();
  const { question, finalTranscript, attempts, revealedAnswer } = item.result;
  const isKanji = question.mode === 'kanji';
  const correction = attempts[attempts.length - 1]?.correctedAnswer;

  return (
    <div className="mistake-row">
      <div className="mistake-main">
        <div className={`mistake-prompt ${isKanji ? 'jp-text' : ''}`}>{question.prompt}</div>
        <dl className="mistake-answers">
          <dt>{t('recap.yourAnswer')}</dt>
          <dd className="mistake-wrong jp-text">{finalTranscript || t('common.noAnswer')}</dd>
          <dt>{t('mistakes.correct')}</dt>
          <dd className="mistake-right jp-text">
            {question.expectedAnswer}
            {isKanji && question.intendedMeaning && (
              <span className="mistake-meaning"> · {question.intendedMeaning}</span>
            )}
          </dd>
          {correction && correction !== question.expectedAnswer && (
            <>
              <dt>{t('recap.correction')}</dt>
              <dd className="jp-text">{correction}</dd>
            </>
          )}
        </dl>
        <div className="mistake-meta">
          <span className="badge badge-accent">{question.jlptLevel}</span>
          <span>{formatDate(item.at)}</span>
          {revealedAnswer && <span>{t('mistakes.gaveUp')}</span>}
        </div>
      </div>
      <RowActions sessionId={item.sessionId} onDismiss={onDismiss} />
    </div>
  );
}

function ConversationRow({ item, onDismiss }: { item: ConversationMistake; onDismiss: () => void }) {
  const { t } = useI18n();
  const formatDate = useFormatDate();
  const correction = item.message.correction!;

  return (
    <div className="mistake-row">
      <div className="mistake-main">
        <dl className="mistake-answers">
          <dt>{t('mistakes.youWrote')}</dt>
          <dd className="mistake-wrong jp-text">{item.message.text}</dd>
          <dt>{t('recap.correction')}</dt>
          <dd className="mistake-right jp-text">{correction.corrected}</dd>
        </dl>
        {correction.explanation && <p className="mistake-explanation">{correction.explanation}</p>}
        <div className="mistake-meta">
          <MessageCircle size={12} />
          <span>{item.topic || t('common.randomTopic')}</span>
          <span>{formatDate(item.at)}</span>
        </div>
      </div>
      <RowActions sessionId={item.sessionId} onDismiss={onDismiss} />
    </div>
  );
}
