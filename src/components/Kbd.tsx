// A keyboard shortcut badge on a button (laptops only: hidden on touch screens by CSS).
// Alt shortcuts show as ⌥ on a Mac.

import { ALT_KEY } from '../i18n';

/** `alt`: Alt + key (the answer box is focused, so plain letters would type); else the key alone (Enter) */
export function Kbd({ k, alt = false }: { k: string; alt?: boolean }) {
  return <kbd className="kbd" aria-hidden="true">{alt ? `${ALT_KEY}${k}` : k}</kbd>;
}
