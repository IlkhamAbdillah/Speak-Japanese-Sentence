import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Zap,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import type { UserSettings, AIProvider, ExerciseMode, JLPTLevel, InstructionLanguage } from '../types';
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDER_MODELS,
  EXERCISE_MODE_LABELS,
  EXERCISE_MODE_DESCRIPTIONS,
  JLPT_DESCRIPTIONS,
} from '../types';
import { testConnection, fetchOllamaModels } from '../services/ai';
import { saveSettings, clearApiKey } from '../services/storage';

interface SettingsPageProps {
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
}

export default function SettingsPage({ settings, onSettingsChange }: SettingsPageProps) {
  const navigate = useNavigate();
  const [showKey, setShowKey] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connError, setConnError] = useState('');
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchStatus, setFetchStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [manualModelInput, setManualModelInput] = useState(false);

  const lang = settings.instructionLanguage;

  const update = (partial: Partial<UserSettings>) => {
    const next = { ...settings, ...partial };
    onSettingsChange(next);
  };

  const handleTestConnection = async () => {
    if (settings.aiProvider !== 'ollama' && !settings.apiKey) return;
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
      setConnError(result.error || 'Connection failed');
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
            lang === 'id'
              ? 'Tidak ada model ditemukan. Pastikan Anda sudah pull model (misal: ollama pull llama3.1).'
              : 'No models found. Ensure you have pulled a model (e.g. ollama pull llama3.1).',
        });
      } else {
        setFetchedModels(models);
        setManualModelInput(false);
        setFetchStatus({
          type: 'success',
          message:
            lang === 'id'
              ? `Ditemukan ${models.length} model!`
              : `Found ${models.length} model(s)!`,
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
    navigate('/');
  };

  const handleClearKey = () => {
    clearApiKey();
    update({ apiKey: '' });
    setConnStatus('idle');
  };

  return (
    <div className="app-main" style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 className="card-title" style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2xl)' }}>
        {lang === 'id' ? '⚙️ Pengaturan' : '⚙️ Settings'}
      </h1>

      {/* AI Provider */}
      <div className="settings-section">
        <h2 className="settings-section-title">
          {lang === 'id' ? 'Provider AI' : 'AI Provider'}
        </h2>

        <div className="form-group">
          <label className="form-label">{lang === 'id' ? 'Provider' : 'Provider'}</label>
          <div className="option-group">
            {(Object.keys(AI_PROVIDER_LABELS) as AIProvider[]).map((p) => (
              <button
                key={p}
                className={`option-pill ${settings.aiProvider === p ? 'active' : ''}`}
                onClick={() => update({ aiProvider: p, aiModel: AI_PROVIDER_MODELS[p][0] })}
              >
                {AI_PROVIDER_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {settings.aiProvider === 'ollama' && (
          <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)' }}>
            {lang === 'id'
              ? 'Mendukung Ollama lokal (http://localhost:11434/v1) maupun (https://example.com/api/v1). Pastikan model sudah di-pull di instance Ollama tersebut.'
              : 'Supports local Ollama (http://localhost:11434/v1) or (https://example.com/api/v1). Ensure the model is pulled on the Ollama instance.'}
          </div>
        )}

        {/* Ollama URL (shown first for Ollama so user can configure URL before fetching models) */}
        {settings.aiProvider === 'ollama' && (
          <div className="form-group">
            <label className="form-label">
              {lang === 'id' ? 'Ollama API URL / Tunnel URL' : 'Ollama API URL / Tunnel URL'}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="http://localhost:11434/v1 atau https://tunnel.example.com"
              value={settings.ollamaBaseUrl ?? 'http://localhost:11434/v1'}
              onChange={(e) => update({ ollamaBaseUrl: e.target.value })}
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
              {lang === 'id'
                ? 'Bisa berupa http://localhost:11434/v1, IP LAN, atau URL (https://example.com/api/v1). Akhiran /v1 akan disesuaikan otomatis.'
                : 'Can be http://localhost:11434/v1, local LAN IP, or URL (https://example.com/api/v1). Suffix /v1 is handled automatically.'}
            </p>
          </div>
        )}

        {/* Model field */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Model</label>
            {settings.aiProvider === 'ollama' && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleFetchModels}
                disabled={isFetchingModels}
                style={{ fontSize: 'var(--text-xs)', padding: '3px 10px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                {isFetchingModels ? (
                  <>
                    <Loader2 size={12} className="spinner" style={{ border: 'none', animation: 'spin 0.8s linear infinite' }} />
                    {lang === 'id' ? 'Mengambil...' : 'Fetching...'}
                  </>
                ) : (
                  <>
                    <RefreshCw size={12} />
                    {lang === 'id' ? 'Fetch Model' : 'Fetch Models'}
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
                    {lang === 'id' ? '✏️ Ketik Manual' : '✏️ Type Manual'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <input
                    className="form-input"
                    placeholder={lang === 'id' ? 'Nama model (misal: llama3.1)' : 'Model name (e.g. llama3.1)'}
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
                      {lang === 'id' ? '📋 Pilih Daftar' : '📋 Pick List'}
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
                    ? (lang === 'id' ? 'Model berhasil diambil dari server Ollama.' : 'Models loaded from Ollama server.')
                    : (lang === 'id'
                      ? 'Klik "Fetch Model" untuk melihat model yang terinstall di Ollama Anda, atau ketik manual.'
                      : 'Click "Fetch Models" to list installed models from your Ollama instance, or type manually.')}
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
              ? (lang === 'id' ? 'API Key / Token (Opsional)' : 'API Key / Token (Optional)')
              : 'API Key'}
          </label>
          <div className="password-input-wrapper">
            <input
              type={showKey ? 'text' : 'password'}
              className="form-input"
              placeholder={
                settings.aiProvider === 'ollama'
                  ? (lang === 'id' ? 'Kosongkan jika tanpa password/token...' : 'Leave empty if no auth token required...')
                  : (lang === 'id' ? 'Masukkan API key...' : 'Enter API key...')
              }
              value={settings.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
            />
            <button
              className="password-toggle"
              onClick={() => setShowKey(!showKey)}
              type="button"
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
            {settings.aiProvider === 'ollama'
              ? (lang === 'id'
                ? 'Opsional: isi jika tunnel reverse proxy Anda diproteksi Bearer token.'
                : 'Optional: provide if your reverse proxy is protected by a Bearer token.')
              : (lang === 'id'
                ? 'Disimpan di perangkat Anda. Tidak pernah dikirim ke server kami.'
                : 'Stored on your device. Never sent to our servers.')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={handleTestConnection}
            disabled={
              (settings.aiProvider !== 'ollama' && !settings.apiKey) ||
              connStatus === 'testing'
            }
          >
            {connStatus === 'testing' ? (
              <><Loader2 size={14} className="spinner" style={{ border: 'none', animation: 'spin 0.8s linear infinite' }} /> {lang === 'id' ? 'Menguji...' : 'Testing...'}</>
            ) : (
              <><Zap size={14} /> {lang === 'id' ? 'Test Koneksi' : 'Test Connection'}</>
            )}
          </button>

          {settings.apiKey && (
            <button className="btn btn-ghost btn-sm" onClick={handleClearKey}>
              <Trash2 size={14} /> {lang === 'id' ? 'Hapus Key' : 'Clear Key'}
            </button>
          )}

          {connStatus === 'success' && (
            <span className="connection-status connected">
              <Check size={14} /> {lang === 'id' ? 'Terhubung' : 'Connected'}
            </span>
          )}
          {connStatus === 'error' && (
            <span className="connection-status error">
              <AlertCircle size={14} /> {connError}
            </span>
          )}
        </div>
      </div>

      {/* Exercise Mode */}
      <div className="settings-section">
        <h2 className="settings-section-title">
          {lang === 'id' ? 'Mode Latihan' : 'Exercise Mode'}
        </h2>
        <div className="mode-cards">
          {(Object.keys(EXERCISE_MODE_LABELS) as ExerciseMode[]).map((mode) => (
            <div
              key={mode}
              className={`mode-card ${settings.exerciseMode === mode ? 'active' : ''}`}
              onClick={() => update({ exerciseMode: mode })}
            >
              <div className="mode-card-title">
                {EXERCISE_MODE_LABELS[mode][lang]}
              </div>
              <div className="mode-card-desc">
                {EXERCISE_MODE_DESCRIPTIONS[mode][lang]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* JLPT Level */}
      <div className="settings-section">
        <h2 className="settings-section-title">
          {lang === 'id' ? 'Level JLPT' : 'JLPT Level'}
        </h2>
        <div className="option-group">
          {(['N5', 'N4', 'N3', 'N2', 'N1'] as JLPTLevel[]).map((level) => (
            <button
              key={level}
              className={`option-pill ${settings.jlptLevel === level ? 'active' : ''}`}
              onClick={() => update({ jlptLevel: level })}
              title={JLPT_DESCRIPTIONS[level][lang]}
            >
              {level}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-sm)' }}>
          {JLPT_DESCRIPTIONS[settings.jlptLevel][lang]}
        </p>
      </div>

      {/* Question Count */}
      <div className="settings-section">
        <h2 className="settings-section-title">
          {lang === 'id' ? 'Jumlah Soal' : 'Question Count'}
        </h2>
        <div className="option-group">
          {[5, 10, 15, 20].map((n) => (
            <button
              key={n}
              className={`option-pill ${settings.questionCount === n ? 'active' : ''}`}
              onClick={() => update({ questionCount: n })}
            >
              {n} {lang === 'id' ? 'soal' : 'questions'}
            </button>
          ))}
        </div>
      </div>

      {/* Instruction Language */}
      <div className="settings-section">
        <h2 className="settings-section-title">
          {lang === 'id' ? 'Bahasa Instruksi' : 'Instruction Language'}
        </h2>
        <div className="option-group">
          {([
            { value: 'id' as InstructionLanguage, label: '🇮🇩 Indonesia' },
            { value: 'en' as InstructionLanguage, label: '🇺🇸 English' },
          ]).map((opt) => (
            <button
              key={opt.value}
              className={`option-pill ${settings.instructionLanguage === opt.value ? 'active' : ''}`}
              onClick={() => update({ instructionLanguage: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="settings-section">
        <h2 className="settings-section-title">
          {lang === 'id' ? 'Opsi Lainnya' : 'Additional Options'}
        </h2>

        <div className="form-group">
          <label className="form-label">{lang === 'id' ? 'Maks. Percobaan per Soal' : 'Max Attempts per Question'}</label>
          <select
            className="form-select"
            value={settings.maxAttempts}
            onChange={(e) => update({ maxAttempts: Number(e.target.value) })}
          >
            {[2, 3, 5, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-xl)', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={settings.hintsEnabled}
              onChange={(e) => update({ hintsEnabled: e.target.checked })}
            />
            {lang === 'id' ? 'Aktifkan petunjuk' : 'Enable hints'}
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={settings.autoAdvance}
              onChange={(e) => update({ autoAdvance: e.target.checked })}
            />
            {lang === 'id' ? 'Lanjut otomatis jika benar' : 'Auto-advance on correct'}
          </label>
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
        <button className="btn btn-primary btn-lg" onClick={handleSave}>
          {lang === 'id' ? 'Simpan Pengaturan' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
