"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Popover } from "@/components/calendar/Popover";
import { TaskIcon } from "@/components/shell/icons";
import { TaskList, type TaskListProps } from "@/components/tasks/TaskList";
import { Badge, Button } from "@/components/ui";

/** Set by HomeTodo: the 오늘 할 일 list reports its open 지남 + 오늘 count here. */
const OpenCountContext = createContext<((count: number) => void) | null>(null);

/**
 * Todo: a check-icon button next to 빠른 추가 with the open 지남 + 오늘 count as a badge
 * (none at 0; the count is in the button's name, "할 일 3개"). It opens a popover with
 * `today` (오늘 할 일: overdue, today, finished ones struck through) over `upcoming`
 * (이번 주). Until the popover opens the badge is the server's `count`; after that the list
 * itself reports it (`TodayTaskList`), so checks, failed saves and refreshes all follow what
 * the list shows. Once opened it stays mounted and is only hidden.
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
  const [listCount, setListCount] = useState<number | null>(null);
  // A new server count wins until the list reports again (an emptied list never reports).
  const [prevCount, setPrevCount] = useState(count);
  if (prevCount !== count) {
    setPrevCount(count);
    setListCount(null);
  }
  const shown = listCount ?? count;

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
            className="absolute -top-2 -right-2 h-4 min-w-4 justify-center rounded-full px-1 text-xs leading-none tabular-nums"
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
            <OpenCountContext.Provider value={setListCount}>{today}</OpenCountContext.Provider>
            {upcoming}
          </div>
        </Popover>
      ) : null}
    </>
  );
}

/**
 * The 오늘 할 일 TaskList. Inside HomeTodo it reports the badge count on every change: its
 * open tasks due today or earlier (a reopened task due later, or undated, does not count)
 * plus `hidden`, the open ones past the list's cap.
 */
export function TodayTaskList({ hidden = 0, ...props }: TaskListProps & { hidden?: number }) {
  const report = useContext(OpenCountContext);
  const { today } = props;
  const onOpenChange = useCallback(
    (open: readonly { dueDate: string | null }[]) =>
      report?.(open.filter((t) => t.dueDate !== null && t.dueDate <= today).length + hidden),
    [report, today, hidden],
  );
  return <TaskList {...props} onOpenChange={report ? onOpenChange : undefined} />;
}
