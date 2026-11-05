"use client";

import { useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Popover } from "@/components/calendar/Popover";
import { TaskIcon } from "@/components/shell/icons";
import { Badge, Button } from "@/components/ui";

/**
 * Todo: a check-icon button next to 빠른 추가 with the open 지남 + 오늘 count as a badge
 * (none at 0; the count is in the button's name, "할 일 3개"). It opens a popover with
 * `today` (오늘 할 일: overdue, today, finished ones struck through) over `upcoming`
 * (이번 주). Checking a task in `today` moves the badge at once; the server count takes
 * over when the page refreshes. Once opened it stays mounted and is only hidden.
 */
export function HomeTodo({
  count,
  today,
  upcoming,
}: {
  /** Open overdue + today tasks, from the server. */
  count: number;
  today: ReactNode;
  upcoming?: ReactNode;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Local checks since the last server count (reset when a new count arrives).
  const [delta, setDelta] = useState(0);
  const [prevCount, setPrevCount] = useState(count);
  if (prevCount !== count) {
    setPrevCount(count);
    setDelta(0);
  }
  const shown = Math.max(0, count + delta);

  const show = () => {
    setMounted(true);
    setOpen(true);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    const button = buttonRef.current;
    if (refocus) button?.focus();
    else
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || active === document.body) button?.focus();
      });
  };

  // Task rows' done checkboxes bubble their change up here.
  const onChange = (e: ChangeEvent<HTMLDivElement>) => {
    const t = e.target as EventTarget;
    if (t instanceof HTMLInputElement && t.type === "checkbox") {
      setDelta((d) => d + (t.checked ? -1 : 1));
    }
  };

  return (
    <>
      <Button
        ref={buttonRef}
        variant="secondary"
        size="icon"
        className="relative size-7"
        aria-label={`할 일 ${shown}개`}
        title="할 일"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={mounted ? id : undefined}
        onClick={() => (open ? close(true) : show())}
      >
        <TaskIcon />
        {shown ? (
          <Badge
            tone="blue"
            aria-hidden="true"
            data-testid="todo-count"
            className="absolute -top-1.5 -right-1.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none tabular-nums"
          >
            {shown}
          </Badge>
        ) : null}
      </Button>
      {mounted ? (
        <Popover
          id={id}
          anchor={buttonRef.current}
          onClose={close}
          label="할 일"
          align="end"
          hidden={!open}
          className="max-h-[min(32rem,calc(100vh-6rem))] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto p-3"
        >
          {/* Layout on an inner box: a display class on the root would beat `hidden`. */}
          <div className="flex flex-col gap-4">
            <div onChange={onChange}>{today}</div>
            {upcoming}
          </div>
        </Popover>
      ) : null}
    </>
  );
}
