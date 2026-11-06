import { useEffect, useRef } from 'react';
import { prefersPushToTalk } from '../services/speech';

/**
 * Alt + letter shortcuts for the quiz buttons (user-requested: a whole quiz without the
 * mouse). Alt is used because the answer box is focused and plain letters would type into
 * it, and the Japanese IME never takes Alt combinations. Matched on the physical key
 * (`e.code`), since Option+letter types a symbol on a Mac. A missing handler = off.
 */
export function useAltShortcuts(handlers: Partial<Record<string, (() => void) | false | undefined>>) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (prefersPushToTalk()) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.repeat || !e.code.startsWith('Key')) return;
      const handler = handlersRef.current[e.code.slice(3)];
      if (!handler) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
