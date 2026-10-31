import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutGrid, Search, X } from 'lucide-react';
import type { KanjiPart } from '../services/kanjiList';
import { COMPONENTS, findPart, KANJI_LIST, matchesPartSearch, PARTS } from '../services/kanjiList';
import { useI18n } from '../i18n';

interface RadicalPickerProps {
  /** Id of the picked part; '' = all */
  value: string;
  onChange: (id: string) => void;
}

/**
 * Parts learners look for most (meaning parts of many common kanji), shown first.
 * Ids are KRADFILE's: 汁 = 氵, 化 = 亻, 扎 = 扌, 艾 = 艹, 込 = 辶, 忙 = 忄, 阡 / 邦 = 阝.
 */
const COMMON_IDS = [
  '汁', '化', '扎', '木', '口', '言', '糸', '艾', '込', '門', '日', '月', '土', '女',
  '心', '忙', '金', '貝', '宀', '竹', '雨', '火', '目', '力', '刈', '食', '車', '阡', '邦',
];

const COMMON = COMMON_IDS.map(findPart).filter((p): p is KanjiPart => !!p);
const KANJI_BY_CHAR = new Map(KANJI_LIST.map((e) => [e.kanji, e]));

/** The parts grouped by stroke count, as kanji dictionaries do (PARTS is in that order). */
const GROUPS = (() => {
  const groups: { strokes: number; parts: KanjiPart[] }[] = [];
  for (const p of PARTS) {
    if (groups.at(-1)?.strokes !== p.strokes) groups.push({ strokes: p.strokes, parts: [] });
    groups.at(-1)!.parts.push(p);
  }
  return groups;
})();

/**
 * The Radical filter of the Kanji list (user-requested option B): a button that opens
 * every part as a grid of glyph buttons, a Common row first, then one row per stroke
 * count, with a search box: the part, its English name, reading or Japanese name (kana
 * or romaji: "tera", "temple", "sanzui"), which also finds larger parts (寺), or a
 * kanji to see its parts.
 */
export default function RadicalPicker({ value, onChange }: RadicalPickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const picked = value ? findPart(value) : undefined;

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Search: a kanji of the list shows its parts (also the larger ones, 待 → 寺); otherwise
  // parts and larger parts by the part itself, English name, reading or Japanese name, kana or romaji
  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    const kanji = [...q].map((ch) => KANJI_BY_CHAR.get(ch)).find((e) => e && !findPart(e.kanji));
    if (kanji) {
      const ids = [...kanji.parts, ...kanji.components];
      return { kanji: kanji.kanji, parts: ids.map(findPart).filter((p): p is KanjiPart => !!p), larger: [] };
    }
    return {
      kanji: null,
      parts: PARTS.filter((p) => matchesPartSearch(p, q)),
      larger: COMPONENTS.filter((p) => matchesPartSearch(p, q)).slice(0, 24),
    };
  }, [query]);

  const chip = (p: KanjiPart, withName = false) => {
    const label = t('kanjiList.radicalOption', { glyphs: p.glyph, name: p.name, count: p.count });
    return (
      <button
        key={p.id}
        className={`radical-chip ${withName ? 'with-name' : ''} ${p.id === value ? 'active' : ''}`}
        onClick={() => pick(p.id)}
        title={label}
        aria-label={label}
        aria-pressed={p.id === value}
      >
        <span className="radical-chip-glyph jp-text" lang="ja">{p.glyph}</span>
        {withName && <span className="radical-chip-name">{p.name}</span>}
      </button>
    );
  };

  return (
    <>
      <button type="button" className="form-select radical-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {picked ? (
          <>
            <span className="jp-text" lang="ja">{picked.glyph}</span>
            {' · '}{picked.name} ({picked.count})
          </>
        ) : t('kanjiList.allRadicals')}
      </button>

      {/* In a portal: the filter sits inside an animated (transformed) panel, which would
          make the fixed overlay position itself against the panel instead of the screen */}
      {open && createPortal(
        <div className="dialog-overlay" onClick={() => setOpen(false)}>
          <div
            className="dialog radical-picker"
            role="dialog"
            aria-modal="true"
            aria-label={t('kanjiList.radical')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="radical-picker-top">
              <div className="vocab-search radical-picker-search">
                <Search size={16} />
                <input
                  className="form-input"
                  type="search"
                  // Not on phones: the keyboard would cover the grid
                  autoFocus={!window.matchMedia('(pointer: coarse)').matches}
                  placeholder={t('kanjiList.radicalSearch')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)} aria-label={t('kanjiList.close')}>
                <X size={18} />
              </button>
            </div>

            <div className="radical-picker-body">
              {results ? (
                <>
                  {results.kanji && (
                    <div className="radical-picker-heading">{t('kanjiList.partsOf', { kanji: results.kanji })}</div>
                  )}
                  {results.parts.length + results.larger.length === 0 && (
                    <p className="empty-state-text">{t('kanjiList.noPartMatch', { query })}</p>
                  )}
                  {results.parts.length > 0 && <div className="radical-chips">{results.parts.map((p) => chip(p, true))}</div>}
                  {results.larger.length > 0 && (
                    <>
                      <div className="radical-picker-heading">{t('kanjiList.largerParts')}</div>
                      <div className="radical-chips">{results.larger.map((p) => chip(p, true))}</div>
                    </>
                  )}
                </>
              ) : (
                <>
<div className="radical-chips radical-all-row">
                    <button
                      className={`radical-chip with-name radical-all ${value === '' ? 'active' : ''}`}
                      onClick={() => pick('')}
                      aria-pressed={value === ''}
                    >
                      <LayoutGrid size={16} />
                      {t('kanjiList.allRadicals')}
                    </button>
                  </div>
                  <div className="radical-picker-heading">{t('kanjiList.commonParts')}</div>
                  <div className="radical-chips">{COMMON.map((p) => chip(p, true))}</div>
                  <div className="radical-picker-heading">{t('kanjiList.byStrokes')}</div>
                  {GROUPS.map((g) => (
                    <div key={g.strokes} className="radical-row">
                      <span className="radical-row-strokes" title={t('kanjiList.partStrokes', { count: g.strokes })}>{g.strokes}</span>
                      <div className="radical-chips">{g.parts.map((p) => chip(p))}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
