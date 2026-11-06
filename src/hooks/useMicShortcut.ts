import { useEffect, useRef } from 'react';
import { prefersPushToTalk } from '../services/speech';

/**
 * Laptops: Alt+V (⌥V on a Mac) does what clicking the mic does (start listening, or ■
 * while listening; user-requested). It always works: the Japanese IME never takes Alt
 * combinations and they never type text. Plain V works too, but only while the answer
 * box is empty and the IME is off (with the IME on the browser gives V to the IME).
 * Phones use push-to-talk and have no keyboard shortcut.
 */
export function useMicShortcut(onPress: () => void, enabled: boolean, listening: boolean) {
  const listeningRef = useRef(listening);
  const onPressRef = useRef(onPress);
  useEffect(() => {
    onPressRef.current = onPress;
    listeningRef.current = listening;
  });

  useEffect(() => {
    if (!enabled || prefersPushToTalk()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey) return;
      // Alt+V: matched on the physical key (Option+V types √ on a Mac)
      if (e.altKey) {
        if (e.code !== 'KeyV') return;
        e.preventDefault();
        onPressRef.current();
        return;
      }
      if ((e.key !== 'v' && e.key !== 'V') || e.isComposing) return;
      const target = e.target;
      if (!listeningRef.current) {
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          if (target.value !== '') return;
        } else if (target instanceof HTMLElement && target.isContentEditable) {
          return;
        }
      }
      e.preventDefault();
      onPressRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
