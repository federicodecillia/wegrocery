"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EMOJI_CATALOG, searchEmoji } from "@/lib/emoji-catalog";
import { t } from "@/lib/i18n";

type Props = {
  /** Form field name — used by FormData on the parent form. */
  name: string;
  /** Initial emoji value. */
  value: string;
  /** Optional callback when the user picks/types an emoji. */
  onChange?: (emoji: string) => void;
};

const POPOVER_WIDTH = 296;
const GAP = 8;
const VIEWPORT_MARGIN = 8;

type Coords = {
  left: number;
  top: number;
  maxHeight: number;
};

/**
 * Searchable emoji picker. Renders as a small button showing the current
 * emoji. Clicking opens a popover with a text-search box and a grid of
 * food-relevant emojis (see `lib/emoji-catalog.ts`). The selected value is
 * mirrored to a hidden `<input name={name}>` so existing form-data wiring
 * keeps working without any server-side changes.
 *
 * The popover is rendered through a portal with fixed positioning so it
 * escapes any `overflow:hidden/auto` ancestor (e.g. a scrollable table inside
 * a modal) instead of being clipped. Coordinates are clamped to the viewport
 * so it stays fully visible on mobile too.
 */
export function EmojiPicker({ name, value, onChange }: Props) {
  const [current, setCurrent] = useState(value || "🛒");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Allow the parent to push a new value (e.g. on product-name change the
  // existing auto-suggest logic in prodotti-forms updates the emoji).
  useEffect(() => {
    if (value && value !== current) setCurrent(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const reposition = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const width = Math.min(POPOVER_WIDTH, vw - VIEWPORT_MARGIN * 2);
    // Align the popover's right edge to the trigger's right edge, then clamp
    // so it never spills past either viewport edge.
    let left = rect.right - width;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - width - VIEWPORT_MARGIN));

    const spaceBelow = vh - rect.bottom - GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - GAP - VIEWPORT_MARGIN;
    const placeAbove = spaceBelow < 220 && spaceAbove > spaceBelow;

    const maxHeight = Math.max(180, placeAbove ? spaceAbove : spaceBelow);
    const top = placeAbove
      ? Math.max(VIEWPORT_MARGIN, rect.top - GAP - maxHeight)
      : rect.bottom + GAP;

    setCoords({ left, top, maxHeight });
  }, []);

  // The popover only renders once `coords` is set, so there's no flash at a
  // wrong position even though this runs after paint.
  useEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  // Close on outside-click / Escape, keep position fresh on scroll & resize.
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    // `true` (capture) so we also catch scrolls inside nested containers.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  const filtered = useMemo(() => searchEmoji(query), [query]);

  function pick(emoji: string) {
    setCurrent(emoji);
    onChange?.(emoji);
    setOpen(false);
    setQuery("");
  }

  const popover =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={t.common.chooseEmoji}
            style={{
              position: "fixed",
              left: coords.left,
              top: coords.top,
              width: Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2),
              maxHeight: coords.maxHeight,
            }}
            className="z-[80] flex flex-col overflow-hidden rounded-xl border border-brand-border bg-white shadow-lg"
          >
            <div className="border-b border-brand-border p-2">
              <input
                ref={searchRef}
                type="text"
                placeholder={t.common.emojiSearchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-md border border-brand-border px-2.5 py-1.5 text-[12px] text-brand-near-black placeholder:text-brand-gray-light focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="px-2 py-6 text-center text-[12px] text-brand-gray">
                  {t.common.noEmojiFound(query)}
                </div>
              ) : (
                <div className="grid grid-cols-8 gap-1">
                  {filtered.map((e) => {
                    const isSelected = e.char === current;
                    return (
                      <button
                        type="button"
                        key={e.char + e.name}
                        onClick={() => pick(e.char)}
                        title={e.name}
                        aria-label={e.name}
                        className={`flex h-8 w-8 items-center justify-center rounded-md text-xl leading-none transition hover:bg-brand-teal-light ${
                          isSelected ? "bg-brand-teal-light ring-2 ring-brand-teal" : ""
                        }`}
                      >
                        {e.char}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-brand-border bg-brand-warm-white px-3 py-2 text-[10px] text-brand-gray">
              <span>{t.common.emojiCountOf(filtered.length, EMOJI_CATALOG.length)}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-semibold text-brand-near-black hover:underline"
              >
                {t.common.close}
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      {/* Hidden field that participates in FormData submission. */}
      <input type="hidden" name={name} value={current} readOnly />

      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-[38px] w-full items-center justify-center rounded-lg border border-brand-border bg-white text-2xl leading-none transition hover:border-brand-teal/60 focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
      >
        {current}
      </button>

      {popover}
    </div>
  );
}
