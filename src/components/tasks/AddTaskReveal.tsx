"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui";

// Module-level flag (not an event): a click before the section hydrates is not lost.
let revealed = false;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
const reveal = () => {
  revealed = true;
  listeners.forEach((fn) => fn());
};

/** Small "＋ 할 일" button for the notes header; reveals the hidden empty 할 일 section. */
export function AddTaskButton() {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={reveal}>
      ＋ 할 일
    </Button>
  );
}

/**
 * Wraps the 할 일 section. While `hidden` (no tasks yet) it renders nothing until
 * `AddTaskButton` is pressed; once shown it stays mounted at the same spot, so the add input
 * survives the refresh after the first task is created.
 */
export function RevealOnAddTask({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  const revealedNow = useSyncExternalStore(subscribe, () => revealed, () => false);
  // Latch: a section that had tasks on first render stays mounted when the last one is
  // deleted, so TaskList keeps its 되돌리기 toast and any half-typed add input.
  const [hadTasks] = useState(!hidden);
  // Leaving the page forgets the reveal, so the next project starts hidden again.
  useEffect(() => () => void (revealed = false), []);
  return hadTasks || !hidden || revealedNow ? <>{children}</> : null;
}
