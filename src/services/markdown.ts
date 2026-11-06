// A small Markdown parser for the /docs page (no dependency): headings, paragraphs,
// lists, fenced code, tables, block quotes and rules. components/Markdown.tsx renders
// the blocks (and the inline markup) as React elements.

export interface Heading {
  level: number;
  text: string;
  id: string;
}

export type Block =
  | { kind: 'heading'; level: number; text: string; id: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; start: number; items: string[] }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'quote'; text: string }
  | { kind: 'image'; alt: string; src: string }
  | { kind: 'rule' };

/** "Data storage" → "data-storage" (heading anchors) */
export const slugify = (text: string) =>
  text.toLowerCase().replace(/[`*]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  const isBlockStart = (l: string) =>
    /^(#{1,6} |```|> |!\[|\s*[-*] |\s*\d+\. |\|)/.test(l) || /^-{3,}$/.test(l.trim());

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const heading = /^(#{1,6}) (.*)$/.exec(line);
    if (heading) {
      const text = heading[2].trim();
      blocks.push({ kind: 'heading', level: heading[1].length, text, id: slugify(text) });
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      blocks.push({ kind: 'code', lang, text: body.join('\n') });
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line.trim());
    if (image) { blocks.push({ kind: 'image', alt: image[1], src: image[2] }); i++; continue; }
    if (/^-{3,}$/.test(line.trim())) { blocks.push({ kind: 'rule' }); i++; continue; }
    if (line.startsWith('|') && lines[i + 1]?.trim().startsWith('|') && /^[\s|:-]+$/.test(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]));
      blocks.push({ kind: 'table', head, rows });
      continue;
    }
    if (line.startsWith('> ')) {
      const body: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) body.push(lines[i++].slice(2));
      blocks.push({ kind: 'quote', text: body.join(' ') });
      continue;
    }
    const listItem = /^\s*([-*]|\d+\.) (.*)$/.exec(line);
    if (listItem) {
      const ordered = /\d/.test(listItem[1]);
      // A numbered list split by a table goes on counting (4. after the table)
      const start = ordered ? Number.parseInt(listItem[1], 10) : 1;
      const items: string[] = [];
      while (i < lines.length) {
        const m = /^\s*([-*]|\d+\.) (.*)$/.exec(lines[i]);
        if (m) { items.push(m[2]); i++; continue; }
        // An indented line continues the item above
        if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += ` ${lines[i].trim()}`; i++; continue; }
        break;
      }
      blocks.push({ kind: 'list', ordered, start, items });
      continue;
    }
    const body: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) body.push(lines[i++].trim());
    if (body.length === 0) body.push(lines[i++].trim());
    blocks.push({ kind: 'paragraph', text: body.join(' ') });
  }
  return blocks;
}

/** The headings, for the table of contents */
export const headingsOf = (blocks: Block[]): Heading[] =>
  blocks.flatMap((b) => (b.kind === 'heading' ? [{ level: b.level, text: b.text, id: b.id }] : []));
