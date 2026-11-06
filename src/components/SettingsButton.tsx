import { Settings } from 'lucide-react';
import { useI18n } from '../i18n';

/** Next to an AI error: the AI settings may be wrong, so offer a way to fix them. */
export default function SettingsButton({ onClick, large = false }: { onClick: () => void; large?: boolean }) {
  const { t } = useI18n();
  return (
    <button className={`btn btn-secondary ${large ? '' : 'btn-sm'}`} onClick={onClick}>
      <Settings size={large ? 16 : 14} /> {t('header.settings')}
    </button>
  );
}
