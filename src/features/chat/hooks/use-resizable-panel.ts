'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drag-to-resize for the citation panel.
 *
 * Excerpts are raw document text — XML attributes, long code lines — and at a
 * fixed 320px they wrap into an unreadable column. Rather than guess a wider
 * default that steals space from the transcript, let the reader decide.
 *
 * The width is kept in `localStorage` so the choice survives a reload; a reader
 * who widened the panel once should not have to do it on every question.
 */
const STORAGE_KEY = 'docs-hub:citation-panel-width';

export function useResizablePanel({
  min = 280,
  max = 720,
  initial = 320,
}: { min?: number; max?: number; initial?: number } = {}) {
  // Lazy initializer, guarded for the server: `localStorage` does not exist
  // there. Reading it here rather than in an effect means the panel renders at
  // its stored width immediately instead of flashing the default first.
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return initial;
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(stored) && stored >= min && stored <= max ? stored : initial;
  });
  const [isDragging, setIsDragging] = useState(false);

  const clamp = useCallback((value: number) => Math.min(max, Math.max(min, value)), [min, max]);

  // Held in a ref, not state: the move handler runs on every pointer event and
  // must not re-subscribe (or re-render) for each pixel.
  const frame = useRef<number | null>(null);

  const startDrag = useCallback(() => setIsDragging(true), []);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (event: PointerEvent) => {
      // The panel is docked right, so its width is whatever lies between the
      // pointer and the viewport edge.
      const next = clamp(window.innerWidth - event.clientX);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => setWidth(next));
    };

    const onUp = () => setIsDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    // Without this the drag selects the transcript text it passes over.
    const previousSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = previousSelect;
      document.body.style.cursor = previousCursor;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [isDragging, clamp]);

  // Persist only once the drag ends — writing on every frame would hammer
  // localStorage for no benefit.
  useEffect(() => {
    if (isDragging) return;
    window.localStorage.setItem(STORAGE_KEY, String(width));
  }, [isDragging, width]);

  /** Keyboard resizing, so the panel is not mouse-only. */
  const nudge = useCallback(
    (delta: number) => setWidth((current) => clamp(current + delta)),
    [clamp]
  );

  return { width, isDragging, startDrag, nudge, min, max };
}
