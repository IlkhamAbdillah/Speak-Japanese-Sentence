import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import sourceEn from '../docs/system.md?raw';
import sourceId from '../docs/system.id.md?raw';
// The system diagram, written in system.md as ../../images/Docs.png (its path from src/docs)
import systemDiagram from '../../images/Docs.png';
import { Markdown } from '../components/Markdown';
import { headingsOf, parseMarkdown } from '../services/markdown';
import type { InstructionLanguage } from '../i18n';
import { useI18n } from '../i18n';

// The text in each interface language (English for a language without its own file)
const SOURCES: Partial<Record<InstructionLanguage, string>> = { en: sourceEn, id: sourceId };

/**
 * /docs: how the app is built (user-requested; not linked from the menus). The text is
 * src/docs/system.md (English) or system.<lang>.md, following the interface language, rendered by components/Markdown.tsx, with a table
 * of contents beside it on laptops and a collapsible one on phones.
 */
export default function DocsPage() {
  const { t, lang } = useI18n();
  const blocks = useMemo(() => parseMarkdown(SOURCES[lang] ?? sourceEn), [lang]);
  const toc = useMemo(() => headingsOf(blocks).filter((h) => h.level === 2 || h.level === 3), [blocks]);
  const [active, setActive] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);

  useEffect(() => {
    const previous = document.title;
    document.title = t('docs.title');
    return () => { document.title = previous; };
  }, [t]);

  // Highlight the section being read
  useEffect(() => {
    const targets = toc.map((h) => document.getElementById(h.id)).filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-72px 0px -70% 0px' });
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [toc]);

  const jump = (id: string) => {
    setTocOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
  };

  const tocList = (
    <ul className="docs-toc-list">
      {toc.map((h) => (
        <li key={h.id} className={`docs-toc-item level-${h.level} ${active === h.id ? 'active' : ''}`}>
          <a href={`#${h.id}`} onClick={(e) => { e.preventDefault(); jump(h.id); }}>{h.text.replace(/`/g, '')}</a>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="app-main docs-page">
      <aside className="docs-toc" aria-label={t('docs.onThisPage')}>
        <div className="docs-toc-title">{t('docs.onThisPage')}</div>
        {tocList}
      </aside>

      <div className="docs-toc-mobile">
        <button className="docs-toc-toggle" onClick={() => setTocOpen((o) => !o)} aria-expanded={tocOpen}>
          {t('docs.onThisPage')}
          <ChevronDown size={16} className={tocOpen ? 'open' : ''} />
        </button>
        {tocOpen && tocList}
      </div>

      <article className="docs-content animate-in">
        <Markdown blocks={blocks} images={{ '../../images/Docs.png': systemDiagram }} />
      </article>
    </div>
  );
}
