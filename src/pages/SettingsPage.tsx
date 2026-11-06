import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Zap,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import type { UserSettings, AIProvider } from '../types';
import { AI_PROVIDER_LABELS, AI_PROVIDER_MODELS, DEFAULT_SETTINGS, hasAISetup } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import { testConnection, fetchOllamaModels } from '../services/ai';
import { saveSettings, clearApiKey } from '../services/storage';
import { useI18n } from '../i18n';

interface SettingsPageProps {
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
}

export default function SettingsPage({ settings, onSettingsChange }: SettingsPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showKey, setShowKey] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connError, setConnError] = useState('');
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchStatus, setFetchStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [manualModelInput, setManualModelInput] = useState(false);

  const { t } = useI18n();

  const update = (partial: Partial<UserSettings>) => {
    const next = { ...settings, ...partial };
    onSettingsChange(next);
  };

  const handleTestConnection = async () => {
    if (!hasAISetup(settings)) return;
    setConnStatus('testing');
    setConnError('');
    const result = await testConnection(
      settings.aiProvider,
      settings.apiKey,
      settings.aiModel,
      settings.ollamaBaseUrl
    );
    if (result.success) {
      setConnStatus('success');
    } else {
      setConnStatus('error');
      setConnError(result.error || t('settings.connectionFailed'));
    }
  };

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    setFetchStatus(null);
    try {
      const models = await fetchOllamaModels(settings.ollamaBaseUrl, settings.apiKey);
      if (models.length === 0) {
        setFetchStatus({
          type: 'error',
          message:
            t('settings.noModelsFound'),
        });
      } else {
        setFetchedModels(models);
        setManualModelInput(false);
        setFetchStatus({
          type: 'success',
          message:
            t('settings.modelsFound', { count: models.length }),
        });
        // If current model isn't in fetched list, switch to first one
        if (!models.includes(settings.aiModel) && models.length > 0) {
          update({ aiModel: models[0] });
        }
        setTimeout(() => setFetchStatus(null), 4000);
      }
    } catch (err) {
      setFetchStatus({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSave = () => {
    saveSettings(settings);
    // Back to the page that sent the learner here (e.g. a missing-AI notice), else the previous page
    const from = (location.state as { from?: string } | null)?.from;
    if (from) navigate(from);
    else if ((window.history.state as { idx?: number } | null)?.idx) navigate(-1);
    else navigate('/');
  };

  // Remove AI settings: back to no AI at all (default provider, no key, no URL)
  const [confirmRemove, setConfirmRemove] = useState(false);
  const handleRemoveAI = () => {
    setConfirmRemove(false);
    update({
      aiProvider: DEFAULT_SETTINGS.aiProvider,
      aiModel: DEFAULT_SETTINGS.aiModel,
      apiKey: '',
      ollamaBaseUrl: '',
    });
    setConnStatus('idle');
    setConnError('');
    setFetchedModels([]);
    setFetchStatus(null);
    setManualModelInput(false);
  };

  const handleClearKey = () => {
    clearApiKey();
    update({ apiKey: '' });
    setConnStatus('idle');
  };

  return (
    <div className="app-main" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="settings-card animate-in">
      <h1 className="card-title" style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-xs)' }}>
        {t('settings.title')}
      </h1>
      <p className="card-subtitle" style={{ marginBottom: 'var(--space-2xl)' }}>
        {t('settings.subtitle')}
      </p>

      {/* AI Provider */}
      <div className="settings-section">
        <h2 className="settings-section-title">
          {t('settings.aiProvider')}
        </h2>

        <div className="form-group">
          <label className="form-label">{t('settings.provider')}</label>
          <div className="option-group">
            {(Object.keys(AI_PROVIDER_LABELS) as AIProvider[]).map((p) => (
              <button
                key={p}
                className={`option-pill ${settings.aiProvider === p ? 'active' : ''}`}
                onClick={() => update({ aiProvider: p, aiModel: AI_PROVIDER_MODELS[p][0] })}
              >
                {p === 'ollama' ? t('settings.ollamaUrl') : AI_PROVIDER_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {settings.aiProvider === 'ollama' && (
          <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)' }}>
            {t('settings.ollamaInfo')}
          </div>
        )}

        {/* Custom URL (shown first so the URL can be set before fetching models) */}
        {settings.aiProvider === 'ollama' && (
          <div className="form-group">
            <label className="form-label">
              {t('settings.ollamaUrl')}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={t('settings.ollamaUrlPlaceholder')}
              value={settings.ollamaBaseUrl ?? ''}
              onChange={(e) => update({ ollamaBaseUrl: e.target.value })}
            />
          </div>
        )}

        {/* Model field */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>{t('settings.model')}</label>
            {settings.aiProvider === 'ollama' && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleFetchModels}
                disabled={isFetchingModels || !settings.ollamaBaseUrl?.trim()}
                style={{ fontSize: 'var(--text-xs)', padding: '3px 10px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                {isFetchingModels ? (
                  <>
                    <Loader2 size={12} className="spinner" style={{ border: 'none', animation: 'spin 0.8s linear infinite' }} />
                    {t('settings.fetching')}
                  </>
                ) : (
                  <>
                    <RefreshCw size={12} />
                    {t('settings.fetchModels')}
                  </>
                )}
              </button>
            )}
          </div>

          {settings.aiProvider === 'ollama' ? (
            <>
              {fetchedModels.length > 0 && !manualModelInput ? (
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <select
                    className="form-select"
                    value={settings.aiModel}
                    onChange={(e) => update({ aiModel: e.target.value })}
                  >
                    {fetchedModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setManualModelInput(true)}
                    style={{ whiteSpace: 'nowrap', fontSize: 'var(--text-xs)' }}
                  >
                    {t('settings.typeManual')}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <input
                    className="form-input"
                    placeholder={t('settings.modelPlaceholder')}
                    value={settings.aiModel}
                    onChange={(e) => update({ aiModel: e.target.value })}
                    list="ollama-models"
                  />
                  {fetchedModels.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setManualModelInput(false)}
                      style={{ whiteSpace: 'nowrap', fontSize: 'var(--text-xs)' }}
                    >
                      {t('settings.pickList')}
                    </button>
                  )}
                  <datalist id="ollama-models">
                    {(fetchedModels.length > 0 ? fetchedModels : AI_PROVIDER_MODELS.ollama).map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
              )}

              {fetchStatus && (
                <p
                  style={{
                    fontSize: 'var(--text-xs)',
                    marginTop: 'var(--space-xs)',
                    color: fetchStatus.type === 'success' ? 'var(--accent-teal)' : 'var(--accent-red)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {fetchStatus.type === 'success' ? <Check size={13} /> : <AlertCircle size={13} />}
                  {fetchStatus.message}
                </p>
              )}

              {!fetchStatus && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                  {fetchedModels.length > 0
                    ? t('settings.modelsLoaded')
                    : t('settings.fetchModelsHelp')}
                </p>
              )}
            </>
          ) : (
            <select
              className="form-select"
              value={settings.aiModel}
              onChange={(e) => update({ aiModel: e.target.value })}
            >
              {AI_PROVIDER_MODELS[settings.aiProvider].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">
            {settings.aiProvider === 'ollama'
              ? t('settings.apiKeyOptional')
              : t('settings.apiKey')}
          </label>
          <div className="password-input-wrapper">
            <input
              type={showKey ? 'text' : 'password'}
              className="form-input"
              placeholder={
                settings.aiProvider === 'ollama'
                  ? t('settings.apiKeyOptionalPlaceholder')
                  : t('settings.apiKeyPlaceholder')
              }
              value={settings.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
            />
            <button
              className="password-toggle"
              onClick={() => setShowKey(!showKey)}
              type="button"
              aria-label={showKey ? t('settings.hideApiKey') : t('settings.showApiKey')}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
            {settings.aiProvider === 'ollama'
              ? t('settings.apiKeyOptionalHelp')
              : t('settings.apiKeyHelp')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={handleTestConnection}
            disabled={!hasAISetup(settings) || connStatus === 'testing'}
          >
            {connStatus === 'testing' ? (
              <><Loader2 size={14} className="spinner" style={{ border: 'none', animation: 'spin 0.8s linear infinite' }} /> {t('settings.testing')}</>
            ) : (
              <><Zap size={14} /> {t('settings.testConnection')}</>
            )}
          </button>

          {settings.apiKey && (
            <button className="btn btn-ghost btn-sm" onClick={handleClearKey}>
              <Trash2 size={14} /> {t('settings.clearKey')}
            </button>
          )}

          {connStatus === 'success' && (
            <span className="connection-status connected">
              <Check size={14} /> {t('settings.connected')}
            </span>
          )}
          {connStatus === 'error' && (
            <span className="connection-status error">
              <AlertCircle size={14} /> {connError}
            </span>
          )}
        </div>
      </div>

      {/* Remove AI settings: a row between dividers (user-picked design), then Save in the middle */}
      <button
        className="settings-remove-row"
        onClick={() => setConfirmRemove(true)}
        disabled={!settings.apiKey && !settings.ollamaBaseUrl?.trim() && settings.aiProvider === DEFAULT_SETTINGS.aiProvider}
      >
        <Trash2 size={24} className="settings-remove-icon" />
        <span className="settings-remove-text">
          <span className="settings-remove-title">{t('settings.removeAI')}</span>
          <span className="settings-remove-help">{t('settings.removeAIHelp')}</span>
        </span>
        <ChevronRight size={20} className="settings-remove-chevron" />
      </button>

      <div className="settings-actions">
        <button className="btn btn-primary btn-lg" onClick={handleSave}>
          {t('settings.save')}
        </button>
      </div>
      </div>

      {confirmRemove && (
        <ConfirmDialog
          title={t('settings.removeAITitle')}
          text={t('settings.removeAIText')}
          confirmLabel={t('settings.removeAI')}
          onCancel={() => setConfirmRemove(false)}
          onConfirm={handleRemoveAI}
        />
      )}
    </div>
  );
}
