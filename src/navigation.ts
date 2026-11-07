import type { MessageKey } from './i18n';

// The sections of the app, grouped as in the header menus; Home shows the same
// items as cards (in this order).

export interface NavItem {
  path: string;
  glyph: string;
  label: MessageKey;
}

export interface NavGroup {
  id: 'learn' | 'practice';
  label: MessageKey;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'learn',
    label: 'header.learn',
    items: [
      { path: '/words', glyph: '語', label: 'home.menu.words' },
      { path: '/kanji', glyph: '字', label: 'home.menu.kanji' },
      { path: '/grammar', glyph: '文', label: 'home.menu.grammar' },
      { path: '/particles', glyph: 'が', label: 'home.menu.particles' },
    ],
  },
  {
    id: 'practice',
    label: 'header.practice',
    items: [
      { path: '/daily', glyph: '日', label: 'home.menu.daily' },
      { path: '/practice', glyph: '話', label: 'home.menu.practice' },
      { path: '/jlpt', glyph: '試', label: 'home.menu.jlpt' },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Daily Learning: a wide card above the others on Home */
export const DAILY_ITEM = NAV_ITEMS.find((item) => item.path === '/daily')!;
