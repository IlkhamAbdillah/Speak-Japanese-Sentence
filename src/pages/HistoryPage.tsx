import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trash2,
  Eye,
  AlertCircle,
  History as HistoryIcon,
} from 'lucide-react';
import type { SessionSummary, InstructionLanguage } from '../types';
import { EXERCISE_MODE_LABELS } from '../types';
import { getSessionSummaries, deleteSession, clearAllSessions } from '../services/storage';

interface HistoryPageProps {
  lang: InstructionLanguage;
}

export default function HistoryPage({ lang }: HistoryPageProps) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  useEffect(() => {
    setSessions(getSessionSummaries());
  }, []);

  const handleDelete = (sessionId: string) => {
    deleteSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
  };

  const handleClearAll = () => {
    clearAllSessions();
    setSessions([]);
    setConfirmClearAll(false);
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  return (
    <div className="app-main" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)' }}>
        <h1 className="card-title" style={{ fontSize: 'var(--text-2xl)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <HistoryIcon size={24} />
          {lang === 'id' ? 'Riwayat Sesi' : 'Session History'}
        </h1>
        {sessions.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmClearAll(true)}>
            <Trash2 size={14} />
            {lang === 'id' ? 'Hapus Semua' : 'Clear All'}
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p className="empty-state-title">
            {lang === 'id' ? 'Belum ada riwayat sesi' : 'No session history yet'}
          </p>
          <p className="empty-state-text">
            {lang === 'id'
              ? 'Mulai sesi latihan pertama Anda!'
              : 'Start your first practice session!'}
          </p>
        </div>
      ) : (
        sessions.map((s) => (
          <div key={s.sessionId} className="history-item animate-in">
            <div className="history-meta">
              <span className="history-meta-item" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                {formatDate(s.startedAt)}
              </span>
              <span className="badge badge-accent">{s.jlptLevel}</span>
              <span className="badge badge-info">
                {EXERCISE_MODE_LABELS[s.mode][lang]}
              </span>
              <span className="history-meta-item">
                {s.correctCount}/{s.questionCount} ({s.accuracy}%)
              </span>
              <span className="history-meta-item">
                {formatDuration(s.durationMs)}
              </span>
              <span className={`badge ${s.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                {s.status === 'completed'
                  ? (lang === 'id' ? 'Selesai' : 'Completed')
                  : (lang === 'id' ? 'Belum Selesai' : 'Incomplete')}
              </span>
            </div>
            <div className="history-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate(`/recap/${s.sessionId}`)}
              >
                <Eye size={14} /> {lang === 'id' ? 'Lihat' : 'View'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleDelete(s.sessionId)}
                style={{ color: 'var(--color-error)' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))
      )}

      {/* Clear All Dialog */}
      {confirmClearAll && (
        <div className="dialog-overlay" onClick={() => setConfirmClearAll(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog-title">
              <AlertCircle size={20} style={{ color: 'var(--color-error)', display: 'inline', marginRight: 8 }} />
              {lang === 'id' ? 'Hapus Semua Riwayat?' : 'Clear All History?'}
            </h3>
            <p className="dialog-text">
              {lang === 'id'
                ? 'Tindakan ini tidak dapat dibatalkan. Semua riwayat sesi akan dihapus secara permanen.'
                : 'This action cannot be undone. All session history will be permanently deleted.'}
            </p>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmClearAll(false)}>
                {lang === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button className="btn btn-danger" onClick={handleClearAll}>
                {lang === 'id' ? 'Hapus Semua' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
