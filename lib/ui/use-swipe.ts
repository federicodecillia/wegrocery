"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";

// Drag down to close a bottom sheet, with Pointer Events only (no library).
// The rules of the plan's "Gesture" section: the sheet always keeps a visible
// way out (✕, Annulla), the drag starts on the handle and header (never on
// the scrolling body, never from the left edge, which is iOS's "back"), it
// works only where the sheet is a bottom sheet (phones), and it is off with
// "reduce motion".

/** A drag this long closes; a shorter one closes only if it was a flick. */
export const SWIPE_CLOSE_PX = 100;
const FLICK_MIN_PX = 30;
const FLICK_PX_PER_MS = 0.5;
const LEFT_EDGE_PX = 24;

/** Whether a downward drag of `dy` px lasting `ms` dismisses the sheet. */
export function swipeDismisses(dy: number, ms: number): boolean {
  if (dy >= SWIPE_CLOSE_PX) return true;
  return dy >= FLICK_MIN_PX && dy / Math.max(ms, 1) >= FLICK_PX_PER_MS;
}

function swipeAllowed(): boolean {
  return (
    window.matchMedia("(max-width: 639px)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * `target` goes on the element that moves (the sheet), `handlers` on the
 * drag zone (the handle and header, with `touch-action: none`). `onDismiss`
 * runs on a long enough drag: it is the sheet's own close request, so a
 * sheet holding unsaved work still asks first, and on a destructive confirm
 * it means "Annulla".
 */
export function useSwipeDown<T extends HTMLElement>(onDismiss: () => void, enabled = true) {
  const target = useRef<T | null>(null);
  const start = useRef<{ y: number; at: number; id: number } | null>(null);

  function settle() {
    const el = target.current;
    if (!el) return;
    el.style.transition = "transform 200ms ease-out";
    el.style.transform = "";
  }

  const handlers = {
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      if (!enabled || e.button !== 0 || e.clientX < LEFT_EDGE_PX || !swipeAllowed()) return;
      // Buttons and fields inside the zone keep their own taps.
      if ((e.target as HTMLElement).closest("button, a, input, select, textarea, [role=button]")) return;
      start.current = { y: e.clientY, at: e.timeStamp, id: e.pointerId };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      const s = start.current;
      const el = target.current;
      if (!s || s.id !== e.pointerId || !el) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${Math.max(0, e.clientY - s.y)}px)`;
    },
    onPointerUp(e: ReactPointerEvent<HTMLElement>) {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      start.current = null;
      settle();
      if (swipeDismisses(e.clientY - s.y, e.timeStamp - s.at)) onDismiss();
    },
    onPointerCancel() {
      start.current = null;
      settle();
    },
  };

  return { target, handlers };
}
