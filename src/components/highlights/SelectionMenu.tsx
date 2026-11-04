"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Textarea } from "@/components/ui";
import { MAX_HIGHLIGHT_NOTE, type HighlightColor } from "@/lib/highlights";
import { ColorSwatches } from "./ColorSwatches";
import type { PendingHighlight } from "./selection";

const MENU_WIDTH = 248;
const MARGIN = 8;

/**
 * Small floating menu under a text selection: pick a colour to save, or open
 * "메모" to add a note first. Esc or a click elsewhere closes it.
 */
export function SelectionMenu({
  pending,
  saving,
  error,
  onSave,
  onClose,
}: {
  pending: PendingHighlight;
  saving: boolean;
  error: string | null;
  onSave: (color: HighlightColor, note: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  // Focus the first colour on open; give focus back on Esc or after saving, but not
  // when the user clicked elsewhere (focus belongs to what they clicked).
  const returnFocus = useRef(true);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const menu = ref.current;
    return () => {
      const active = document.activeElement;
      const focusInMenuOrLost = !active || active === document.body || menu?.contains(active);
      if (returnFocus.current && focusInMenuOrLost && previous?.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        returnFocus.current = false;
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  // Keep the menu inside the window.
  const left = Math.max(
    MARGIN,
    Math.min(pending.anchor.x - MENU_WIDTH / 2, window.innerWidth - MENU_WIDTH - MARGIN),
  );
  const top = Math.min(pending.anchor.y + MARGIN, window.innerHeight - (noteOpen ? 200 : 64));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="하이라이트 저장"
      className="fixed z-50 flex flex-col gap-2 rounded-lg border border-border bg-bg p-2 shadow-overlay"
      style={{ left, top, width: MENU_WIDTH }}
    >
      <div className="flex items-center justify-between gap-1">
        <ColorSwatches
          disabled={saving}
          labelPrefix="하이라이트 저장: "
          onPick={(color) => onSave(color, note)}
        />
        <Button
          size="sm"
          variant={noteOpen ? "secondary" : "ghost"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setNoteOpen((v) => !v)}
          aria-expanded={noteOpen}
        >
          메모
        </Button>
      </div>
      {noteOpen ? (
        <>
          <Textarea
            rows={3}
            value={note}
            maxLength={MAX_HIGHLIGHT_NOTE}
            placeholder="메모"
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
        </>
      ) : null}
      {saving ? <p className="text-xs text-faint">저장 중…</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
