import type { ReactNode } from 'react';
import type { Block } from '../services/markdown';

// Renders the blocks of services/markdown.ts for the /docs page, with inline `code`,
// **bold**, *em* and [links](url). It builds React elements, never HTML strings, so
// nothing in the text can inject markup.

/** Inline markup: `code`, **bold**, *em*, [text](url) */
function inline(text: string, keyBase = ''): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    const key = `${keyBase}${n++}`;
    if (token.startsWith('`')) out.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith('**')) out.push(<strong key={key}>{inline(token.slice(2, -2), `${key}-`)}</strong>);
    else if (token.startsWith('*')) out.push(<em key={key}>{inline(token.slice(1, -1), `${key}-`)}</em>);
    else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)!;
      const href = link[2];
      const external = /^https?:/.test(href);
      out.push(
        <a key={key} href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
          {inline(link[1], `${key}-`)}
        </a>
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * `images` maps the paths written in `![alt](path)` to URLs, so the page can pass
 * images imported through Vite (hashed file names in the build).
 */
export function Markdown({ blocks, images = {} }: { blocks: Block[]; images?: Record<string, string> }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading': {
            const Tag = `h${Math.min(b.level, 4)}` as 'h1' | 'h2' | 'h3' | 'h4';
            return <Tag key={i} id={b.id}>{inline(b.text)}</Tag>;
          }
          case 'paragraph':
            return <p key={i}>{inline(b.text)}</p>;
          case 'list': {
            const items = b.items.map((item, j) => <li key={j}>{inline(item)}</li>);
            return b.ordered ? <ol key={i} start={b.start}>{items}</ol> : <ul key={i}>{items}</ul>;
          }
          case 'code':
            return <pre key={i} className="docs-code"><code>{b.text}</code></pre>;
          case 'table':
            return (
              <div key={i} className="docs-table-wrap">
                <table>
                  <thead><tr>{b.head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
                  <tbody>{b.rows.map((row, r) => <tr key={r}>{row.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          case 'quote':
            return <blockquote key={i}>{inline(b.text)}</blockquote>;
          case 'image':
            return (
              <figure key={i} className="docs-figure">
                <img src={images[b.src] ?? b.src} alt={b.alt} loading="lazy" />
              </figure>
            );
          case 'rule':
            return <hr key={i} />;
        }
      })}
    </>
  );
}
