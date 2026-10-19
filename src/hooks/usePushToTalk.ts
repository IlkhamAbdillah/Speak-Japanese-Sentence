import { useState, useRef } from 'react';
import type { PointerEvent, MouseEvent, CSSProperties } from 'react';

/** How far the finger must slide (in any direction) while holding the mic to cancel. */
export const SLIDE_CANCEL_PX = 80;

interface PushToTalkCallbacks {
  /** Finger down on the mic */
  onStart: () => void;
  /** Released normally: use what was heard */
  onRelease: () => void;
  /** Released after sliding away: throw away what was heard */
  onCancel: () => void;
}

interface UsePushToTalkReturn {
  /** Spread onto the mic button */
  handlers: {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLButtonElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onContextMenu: (e: MouseEvent) => void;
  };
  /** The mic is being held */
  isHolding: boolean;
  /** Slid far enough: releasing now cancels */
  cancelArmed: boolean;
  /** Moves the button with the finger while sliding */
  buttonStyle: CSSProperties | undefined;
}

/** Hold to talk, release to finish, slide away (any direction) and release to cancel. */
export function usePushToTalk({ onStart, onRelease, onCancel }: PushToTalkCallbacks): UsePushToTalkReturn {
  const [isHolding, setIsHolding] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const startRef = useRef({ x: 0, y: 0 });
  const holdingRef = useRef(false);
  // Read on release, so the latest move counts even before a re-render
  const offsetRef = useRef({ x: 0, y: 0 });

  const distance = (o: { x: number; y: number }) => Math.hypot(o.x, o.y);
  const cancelArmed = isHolding && distance(offset) >= SLIDE_CANCEL_PX;

  const moveTo = (value: { x: number; y: number }) => {
    offsetRef.current = value;
    setOffset(value);
  };

  const end = () => {
    if (!holdingRef.current) return;
    const cancelled = distance(offsetRef.current) >= SLIDE_CANCEL_PX;
    holdingRef.current = false;
    setIsHolding(false);
    moveTo({ x: 0, y: 0 });
    if (cancelled) onCancel();
    else onRelease();
  };

  return {
    handlers: {
      onPointerDown: (e) => {
        if (holdingRef.current) return;
        // Keep receiving move/up events even when the finger slides off the button
        e.currentTarget.setPointerCapture(e.pointerId);
        startRef.current = { x: e.clientX, y: e.clientY };
        holdingRef.current = true;
        setIsHolding(true);
        moveTo({ x: 0, y: 0 });
        onStart();
      },
      onPointerMove: (e) => {
        if (!holdingRef.current) return;
        // The button follows the finger, but no further than a little past the cancel point
        const x = e.clientX - startRef.current.x;
        const y = e.clientY - startRef.current.y;
        const scale = Math.min(1, (SLIDE_CANCEL_PX * 1.25) / (Math.hypot(x, y) || 1));
        moveTo({ x: x * scale, y: y * scale });
      },
      onPointerUp: end,
      onPointerCancel: end,
      onContextMenu: (e) => e.preventDefault(),
    },
    isHolding,
    cancelArmed,
    buttonStyle: isHolding && distance(offset) > 0
      ? { transform: `translate(${offset.x}px, ${offset.y}px)` }
      : undefined,
  };
}
