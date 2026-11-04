"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  createTask,
  deleteTask,
  moveTask,
  moveTaskAfter,
  reloadTasks,
  restoreTask,
  updateTask,
} from "@/app/_actions/tasks";
import type { ActionResult } from "@/app/_actions/result";
import { DateField } from "@/components/fields/DateField";
import { safeAction } from "@/components/links/safe-action";
import { Button, buttonClass, cn, emptyAddBoxClass } from "@/components/ui";
import type { Task, TaskParent } from "@/lib/repo/tasks";
import { addDays, formatDue, parentHref } from "./format";
import { applyDrop, dragPosition, placeInOrder } from "./reorder";

const TITLE_MAX = 300;
/** A just-checked task stays in place this long before moving to 완료 (today.md 2.1). */
const DONE_LINGER_MS = 600;
const UNDO_MS = 5000;
const DONE_SHOWN = 20;

export type TaskListProps = {
  /** Open and done tasks of this list, open ones in display order. */
  tasks: readonly Task[];
  /** Local `YYYY-MM-DD`, decided on the server. */
  today: string;
  label?: string;
  /** Where new tasks go; omit for no add line. */
  addTo?: { parent: TaskParent; dueDate?: string | null };
  /** Show the order handle and 위로/아래로 (lists of one parent only). */
  reorderable?: boolean;
  /** Show a link to each task's parent. */
  showParent?: boolean;
  /** `overdue`: show the due date only when it has passed (date-grouped lists). */
  dueMode?: "all" | "overdue";
  /** Show the folded 완료 group (default true). */
  showCompleted?: boolean;
  /** Start with the done rows expanded (home: finished tasks stay visible, struck through). */
  doneOpen?: boolean;
  className?: string;
};

const parentOf = (t: Task): TaskParent =>
  t.parentType && t.parentId ? { type: t.parentType, id: t.parentId } : null;

/** Monday after `today` (calendar arithmetic). */
function nextMonday(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return addDays(today, (8 - dow) % 7 || 7);
}

/** Pointer travel (px) before a press on the handle becomes a drag. */
const DRAG_THRESHOLD = 4;

/** Drag in progress: fixed geometry from the press, plus what the screen shows. */
type DragState = {
  id: string;
  pointerId: number;
  /** Pointer y at the press, px from the list's top (list coordinates survive scrolling). */
  startY: number;
  /** Last pointer y in the viewport, to re-place the drop when the page scrolls. */
  clientY: number;
  /** Vertical middles of the other movable rows (px from the list's top), in list order. */
  mids: number[];
  /** Top and bottom of the other movable rows relative to the list, for the drop line. */
  edges: { top: number; bottom: number }[];
  /** False until the pointer has moved past the threshold. */
  active: boolean;
  dy: number;
  slot: number;
};

const isAltArrow = (e: ReactKeyboardEvent) =>
  e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown");

export function TaskList({
  tasks,
  today,
  label = "할 일",
  addTo,
  reorderable = false,
  showParent = false,
  dueMode = "all",
  showCompleted = true,
  doneOpen = false,
  className,
}: TaskListProps) {
  // Local copy for optimistic updates; reset whenever the server sends new tasks.
  const [items, setItems] = useState<Task[]>(() => [...tasks]);
  const [prevTasks, setPrevTasks] = useState(tasks);
  if (prevTasks !== tasks) {
    setPrevTasks(tasks);
    setItems([...tasks]);
  }
  const [lingering, setLingering] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  /** The just-deleted task and where it sat in `items`, for 되돌리기. */
  const [undo, setUndo] = useState<{ task: Task; index: number } | null>(null);
  const [showDone, setShowDone] = useState(doneOpen);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [, startTransition] = useTransition();
  const listRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const doneId = useId();
  const helpId = useId();

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const open = items.filter((t) => !t.doneAt || lingering.has(t.id));
  const done = items
    .filter((t) => t.doneAt && !lingering.has(t.id))
    .sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));

  const patchLocal = (id: string, patch: Partial<Task>) =>
    setItems((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const run = <T,>(call: () => Promise<ActionResult<T>>, rollback: () => void) =>
    startTransition(async () => {
      const result = await safeAction(call);
      if (!result.ok) {
        rollback();
        setError(result.error);
      } else {
        setError(null);
      }
    });

  /**
   * Before a row leaves the open list: if focus is in it, move focus to the next row's
   * checkbox, else the add line, else the section heading (so it never drops to <body>).
   */
  const keepFocus = (taskId: string) => {
    const root = rootRef.current;
    const row = root?.querySelector<HTMLElement>(`[data-task-row="${taskId}"]`);
    if (!root || !row || !row.contains(document.activeElement)) return;
    const target =
      row.nextElementSibling?.querySelector<HTMLElement>("input[type=checkbox]") ??
      root.querySelector<HTMLElement>("[data-task-add]") ??
      root.closest("section")?.querySelector<HTMLElement>("h2") ??
      root;
    if (target.tabIndex < 0 && !target.hasAttribute("tabindex")) target.tabIndex = -1;
    target.focus();
  };

  const toggle = (task: Task, checked: boolean) => {
    const before = task.doneAt;
    patchLocal(task.id, { doneAt: checked ? new Date().toISOString() : null });
    if (checked) {
      setLingering((s) => new Set(s).add(task.id));
      setTimeout(() => {
        keepFocus(task.id);
        setLingering((s) => {
          const next = new Set(s);
          next.delete(task.id);
          return next;
        });
      }, DONE_LINGER_MS);
    }
    setAnnounce(checked ? `${task.title}, 완료` : `${task.title}, 미완료`);
    run(
      () => updateTask(task.id, { done: checked }),
      () => patchLocal(task.id, { doneAt: before }),
    );
  };

  const rename = (task: Task, title: string) => {
    const value = title.replace(/\s+/g, " ").trim();
    if (!value || value === task.title) return;
    if (value.length > TITLE_MAX) {
      setError(`${TITLE_MAX}자까지 쓸 수 있습니다.`);
      return;
    }
    patchLocal(task.id, { title: value });
    run(
      () => updateTask(task.id, { title: value }),
      () => patchLocal(task.id, { title: task.title }),
    );
  };

  const setDue = (task: Task, dueDate: string | null) => {
    patchLocal(task.id, { dueDate });
    run(
      () => updateTask(task.id, { dueDate }),
      () => patchLocal(task.id, { dueDate: task.dueDate }),
    );
  };

  const move = (task: Task, direction: "up" | "down") => {
    if (!reorderable) return;
    const openIds = open.filter((t) => !t.doneAt).map((t) => t.id);
    const i = openIds.indexOf(task.id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= openIds.length) return;
    const swapWith = openIds[j]!;
    const snapshot = items;
    setItems((list) => {
      const next = [...list];
      const a = next.findIndex((t) => t.id === task.id);
      const b = next.findIndex((t) => t.id === swapWith);
      [next[a], next[b]] = [next[b]!, next[a]!];
      return next;
    });
    setAnnounce(`${task.title}, ${openIds.length}개 중 ${j + 1}번째로 옮김`);
    // Keep focus on the moved row's handle (or whatever was focused in it).
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>(`[data-task-handle="${task.id}"]`)?.focus();
    });
    run(
      () => moveTask(task.id, direction),
      () => setItems(snapshot),
    );
  };

  /** Open, not-done tasks in list order: the only ones that can be dragged. */
  const movableIds = () => open.filter((t) => !t.doneAt).map((t) => t.id);

  const dragStart = (task: Task, e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!reorderable || task.doneAt || (e.pointerType === "mouse" && e.button !== 0)) return;
    const list = listRef.current;
    if (!list) return;
    const listTop = list.getBoundingClientRect().top;
    const others = movableIds()
      .filter((id) => id !== task.id)
      .map((id) => list.querySelector<HTMLElement>(`[data-task-row="${id}"]`))
      .filter((el): el is HTMLElement => !!el)
      .map((el) => el.getBoundingClientRect());
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      id: task.id,
      pointerId: e.pointerId,
      startY: e.clientY - listTop,
      clientY: e.clientY,
      mids: others.map((r) => r.top - listTop + r.height / 2),
      edges: others.map((r) => ({ top: r.top - listTop, bottom: r.bottom - listTop })),
      active: false,
      dy: 0,
      slot: movableIds().indexOf(task.id),
    });
  };

  const dragMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const list = listRef.current;
    if (!drag || e.pointerId !== drag.pointerId || !list) return;
    const at = dragPosition(drag, e.clientY, list.getBoundingClientRect().top);
    if (!drag.active && Math.abs(at.dy) < DRAG_THRESHOLD) return;
    e.preventDefault();
    setDrag({ ...drag, active: true, clientY: e.clientY, ...at });
  };

  // Scrolling (wheel, auto-scroll) moves the list under a still pointer: re-place the drop.
  const dragActive = !!drag?.active;
  useEffect(() => {
    if (!dragActive) return;
    const onScroll = () => {
      const list = listRef.current;
      if (!list) return;
      const top = list.getBoundingClientRect().top;
      setDrag((d) => (d?.active ? { ...d, ...dragPosition(d, d.clientY, top) } : d));
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, [dragActive]);

  const dragEnd = (task: Task, e: ReactPointerEvent<HTMLButtonElement>, cancel = false) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    setDrag(null);
    if (cancel || !drag.active) return;
    const ids = movableIds();
    const drop = applyDrop(ids, task.id, drag.slot);
    if (!drop) return;
    const snapshot = items;
    setItems((list) => placeInOrder(list, drop.order));
    setAnnounce(`${task.title}, ${ids.length}개 중 ${drop.order.indexOf(task.id) + 1}번째로 옮김`);
    run(
      () => moveTaskAfter(task.id, drop.afterId, drop.beforeId),
      () => {
        // The order may have changed elsewhere: show the server's order, not the old one.
        setItems(snapshot);
        void safeAction(() => reloadTasks(task.id));
      },
    );
  };

  /** Where the drop line sits (px from the list top) while dragging. */
  const dropLineTop = (() => {
    if (!drag?.active || drag.edges.length === 0) return null;
    if (drag.slot === 0) return drag.edges[0]!.top;
    return drag.edges[Math.min(drag.slot, drag.edges.length) - 1]!.bottom;
  })();

  const remove = (task: Task) => {
    keepFocus(task.id);
    const snapshot = items;
    setItems((list) => list.filter((t) => t.id !== task.id));
    setUndo({ task, index: items.findIndex((t) => t.id === task.id) });
    setAnnounce(`‘${task.title}’을 지웠습니다.`);
    run(
      () => deleteTask(task.id),
      () => {
        setItems(snapshot);
        setUndo(null);
      },
    );
  };

  /** Undo: back at its old place (server `sortOrder`, local index), done or not as before. */
  const restore = ({ task, index }: { task: Task; index: number }) => {
    setUndo(null);
    startTransition(async () => {
      const result = await safeAction(() =>
        restoreTask({
          title: task.title,
          parent: parentOf(task),
          dueDate: task.dueDate,
          sortOrder: task.sortOrder,
          doneAt: task.doneAt,
        }),
      );
      if (result.ok) {
        const back = { ...result.data, parentTitle: task.parentTitle };
        setItems((list) =>
          list.some((t) => t.id === back.id)
            ? list
            : [...list.slice(0, Math.max(index, 0)), back, ...list.slice(Math.max(index, 0))],
        );
        setAnnounce(`‘${task.title}’을 되돌렸습니다.`);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  };

  const add = async (title: string): Promise<string | null> => {
    if (!addTo) return null;
    const result = await safeAction(() =>
      createTask({ title, parent: addTo.parent, dueDate: addTo.dueDate ?? null }),
    );
    if (!result.ok) return result.error;
    // The refreshed server list may already hold it.
    setItems((list) => (list.some((t) => t.id === result.data.id) ? list : [...list, result.data]));
    setAnnounce(`${result.data.title}, 추가함`);
    return null;
  };

  const rowProps = {
    today,
    reorderable,
    showParent,
    dueMode,
    helpId,
    onToggle: toggle,
    onRename: rename,
    onDue: setDue,
    onMove: move,
    onRemove: remove,
    drag: {
      start: dragStart,
      move: dragMove,
      end: dragEnd,
      cancel: () => setDrag(null),
    },
  };

  return (
    <div ref={rootRef} className={cn("flex flex-col outline-none", className)}>
      {reorderable ? (
        <span id={helpId} className="sr-only">
          위아래 화살표로 옮깁니다.
        </span>
      ) : null}
      {open.length > 0 ? (
        <ul ref={listRef} aria-label={label} className="relative flex flex-col">
          {open.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              {...rowProps}
              dragOffset={drag?.active && drag.id === t.id ? drag.dy : null}
            />
          ))}
          {dropLineTop !== null ? (
            <li
              aria-hidden
              className="pointer-events-none absolute right-0 left-0 h-0.5 -translate-y-1/2 rounded-full bg-accent"
              style={{ top: dropLineTop }}
            />
          ) : null}
        </ul>
      ) : null}
      {addTo ? <AddLine onAdd={add} bare={open.length === 0} /> : null}
      {error ? (
        <p role="alert" className="py-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
      <p aria-live="polite" className="text-[13px] text-muted">
        {undo ? (
          <>
            ‘{undo.task.title}’을 지웠습니다.{" "}
            <button type="button" className="underline" onClick={() => restore(undo)}>
              되돌리기
            </button>
          </>
        ) : (
          <span className="sr-only">{announce}</span>
        )}
      </p>
      {showCompleted && done.length > 0 ? (
        <div className="mt-1 flex flex-col">
          <button
            type="button"
            aria-expanded={showDone}
            aria-controls={doneId}
            onClick={() => setShowDone((v) => !v)}
            className="flex h-8 w-fit items-center gap-1.5 rounded-md px-1.5 text-[13px] text-muted hover:text-fg"
          >
            <span aria-hidden className="w-3 text-[10px]">
              {showDone ? "▾" : "▸"}
            </span>
            완료 <span className="tabular-nums">{done.length}</span>
          </button>
          <div id={doneId} hidden={!showDone}>
            <ul aria-label={`완료한 ${label}`} className="flex flex-col">
              {done.slice(0, DONE_SHOWN).map((t) => (
                <TaskRow key={t.id} task={t} {...rowProps} reorderable={false} />
              ))}
            </ul>
            {done.length > DONE_SHOWN ? (
              <p className="px-1.5 text-xs text-muted tabular-nums">
                완료 {done.length}개 중 {DONE_SHOWN}개 표시
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type RowProps = {
  task: Task;
  today: string;
  reorderable: boolean;
  showParent: boolean;
  dueMode: "all" | "overdue";
  helpId: string;
  onToggle: (task: Task, checked: boolean) => void;
  onRename: (task: Task, title: string) => void;
  onDue: (task: Task, dueDate: string | null) => void;
  onMove: (task: Task, direction: "up" | "down") => void;
  onRemove: (task: Task) => void;
  drag: {
    start: (task: Task, e: ReactPointerEvent<HTMLButtonElement>) => void;
    move: (e: ReactPointerEvent<HTMLButtonElement>) => void;
    end: (task: Task, e: ReactPointerEvent<HTMLButtonElement>, cancel?: boolean) => void;
    cancel: () => void;
  };
  /** Vertical offset while this row is being dragged; null when it isn't. */
  dragOffset?: number | null;
};

function TaskRow({
  task,
  today,
  reorderable,
  showParent,
  dueMode,
  helpId,
  onToggle,
  onRename,
  onDue,
  onMove,
  onRemove,
  drag,
  dragOffset = null,
}: RowProps) {
  const [editing, setEditing] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  const isDone = Boolean(task.doneAt);
  const due = formatDue(task.dueDate, today, isDone);
  const showDue = due && (dueMode === "all" || due.tone === "red");
  const href = showParent ? parentHref(task) : null;
  const canMove = reorderable && !isDone;

  const onRowKeyDown = (e: ReactKeyboardEvent<HTMLLIElement>) => {
    if (canMove && isAltArrow(e)) {
      e.preventDefault();
      onMove(task, e.key === "ArrowUp" ? "up" : "down");
    }
  };

  return (
    <li
      data-task-row={task.id}
      onKeyDown={onRowKeyDown}
      style={dragOffset !== null ? { transform: `translateY(${dragOffset}px)` } : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-2 rounded-md px-1.5 focus-within:bg-hover hover:bg-hover",
        dragOffset !== null && "z-10 bg-bg shadow-overlay hover:bg-bg",
      )}
    >
      {reorderable ? (
        canMove ? (
          <button
            type="button"
            data-task-handle={task.id}
            aria-label={`순서 바꾸기: ${task.title}`}
            aria-describedby={helpId}
            onKeyDown={(e) => {
              if (e.key === "Escape" && dragOffset !== null) {
                e.preventDefault();
                drag.cancel();
              } else if (!e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                e.preventDefault();
                onMove(task, e.key === "ArrowUp" ? "up" : "down");
              }
            }}
            // Pointer and touch drag; `touch-none` keeps a finger on the handle from scrolling.
            onPointerDown={(e) => drag.start(task, e)}
            onPointerMove={drag.move}
            onPointerUp={(e) => drag.end(task, e)}
            onPointerCancel={(e) => drag.end(task, e, true)}
            onLostPointerCapture={(e) => drag.end(task, e, true)}
            className={cn(
              "grid h-6 w-5 shrink-0 cursor-grab touch-none place-items-center rounded text-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing [@media(hover:none)]:opacity-100",
              dragOffset !== null && "cursor-grabbing opacity-100",
            )}
          >
            <GripIcon />
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )
      ) : null}
      <label className="grid size-6 shrink-0 place-items-center">
        <input
          type="checkbox"
          className="size-4"
          checked={isDone}
          onChange={(e) => onToggle(task, e.target.checked)}
          aria-label={`완료: ${task.title}`}
        />
      </label>
      {editing ? (
        <TitleEditor
          initial={task.title}
          onDone={(value) => {
            setEditing(false);
            if (value !== null) onRename(task, value);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === "F2") {
              e.preventDefault();
              setEditing(true);
            }
          }}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-sm",
            isDone ? "text-muted line-through decoration-border-strong" : "text-fg",
          )}
        >
          {task.title}
        </button>
      )}
      {href && task.parentTitle ? (
        <Link href={href} className="max-w-40 shrink-0 truncate text-xs text-muted hover:text-fg">
          {task.parentTitle}
        </Link>
      ) : null}
      {showDue ? (
        <button
          type="button"
          onClick={() => setDueOpen((v) => !v)}
          title={due.label}
          aria-label={`${due.label}, 마감일 바꾸기`}
          className={cn("shrink-0", due.className)}
        >
          {due.text}
        </button>
      ) : !due && !isDone ? (
        <button
          type="button"
          onClick={() => setDueOpen((v) => !v)}
          className="shrink-0 text-xs text-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          마감일
        </button>
      ) : null}
      <TaskMenu
        task={task}
        canMove={canMove}
        onDue={() => setDueOpen(true)}
        onClearDue={task.dueDate ? () => onDue(task, null) : undefined}
        onMove={(d) => onMove(task, d)}
        onRemove={() => onRemove(task)}
      />
      {dueOpen ? (
        <DuePopover
          value={task.dueDate}
          today={today}
          onPick={(value) => {
            setDueOpen(false);
            if (value !== task.dueDate) onDue(task, value);
          }}
          onClose={() => setDueOpen(false)}
        />
      ) : null}
    </li>
  );
}

function TitleEditor({
  initial,
  onDone,
}: {
  initial: string;
  /** New title, or null to cancel. */
  onDone: (value: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const finished = useRef(false);
  const finish = (v: string | null) => {
    if (finished.current) return;
    finished.current = true;
    onDone(v);
  };
  return (
    <input
      autoFocus
      value={value}
      maxLength={TITLE_MAX}
      aria-label="할 일 제목"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(value.trim() ? value : null)}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (e.key === "Enter") {
          e.preventDefault();
          finish(value.trim() ? value : null);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(null);
        }
      }}
      className="h-7 min-w-0 flex-1 border-b border-border-strong bg-transparent text-sm text-fg outline-none"
    />
  );
}

/** `bare`: no task rows above, so the empty list shows the shared dashed `EmptyAdd` look. */
function AddLine({
  onAdd,
  bare,
}: {
  onAdd: (title: string) => Promise<string | null>;
  bare: boolean;
}) {
  const indent = bare ? "-ml-2 pl-2" : "pl-[30px]";
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Own flag, not useTransition: the transition stays pending through the page refresh
  // that follows the action, which would lock the input between quick entries.
  const [pending, setPending] = useState(false);
  const errorId = useId();
  const tooLong = value.trim().length > TITLE_MAX;

  if (!editing) {
    // Same <button> whether or not the list is empty (only the wrapper's look changes), so
    // focus moved here when the last open task is completed survives the switch to `bare`.
    return (
      <div className={bare ? emptyAddBoxClass : undefined}>
        <button
          type="button"
          data-task-add
          onClick={() => setEditing(true)}
          className={
            bare
              ? buttonClass("ghost", "sm")
              : cn(
                  "flex h-9 w-full items-center rounded-md text-left text-sm text-muted hover:bg-hover hover:text-fg",
                  indent,
                )
          }
        >
          ＋ 할 일 추가
        </button>
      </div>
    );
  }

  const submit = () => {
    const title = value.trim();
    if (!title || tooLong || pending) return;
    setPending(true);
    void onAdd(title).then((failure) => {
      setPending(false);
      if (failure) setError(failure);
      else {
        setError(null);
        setValue("");
      }
    });
  };

  return (
    <div className={cn("flex flex-col", indent)}>
      <input
        autoFocus
        data-task-add
        value={value}
        readOnly={pending}
        placeholder="할 일 추가"
        aria-label="새 할 일"
        aria-invalid={tooLong || Boolean(error)}
        aria-describedby={tooLong || error ? errorId : undefined}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (!value.trim() && !pending) setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setValue("");
            setError(null);
            setEditing(false);
          }
        }}
        className="h-9 border-b border-border-strong bg-transparent text-sm text-fg outline-none"
      />
      {tooLong || error ? (
        <p id={errorId} className="py-1 text-xs text-danger">
          {tooLong ? `${TITLE_MAX}자까지 쓸 수 있습니다.` : error}
        </p>
      ) : null}
    </div>
  );
}

function DuePopover({
  value,
  today,
  onPick,
  onClose,
}: {
  value: string | null;
  today: string;
  onPick: (value: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="마감일"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      className="absolute top-full right-0 z-20 mt-1 flex flex-col gap-2 rounded-lg border border-border bg-bg p-3 shadow-overlay"
    >
      <DateField autoFocus value={value} aria-label="마감일" onChange={(v) => onPick(v || null)} />
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => onPick(today)}>
          오늘
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onPick(addDays(today, 1))}>
          내일
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onPick(nextMonday(today))}>
          다음 주 월요일
        </Button>
      </div>
      {value ? (
        <Button size="sm" variant="ghost" onClick={() => onPick(null)}>
          지우기
        </Button>
      ) : null}
    </div>
  );
}

function TaskMenu({
  task,
  canMove,
  onDue,
  onClearDue,
  onMove,
  onRemove,
}: {
  task: Task;
  canMove: boolean;
  onDue: () => void;
  onClearDue?: () => void;
  onMove: (direction: "up" | "down") => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onDown = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = (focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };
  const pick = (fn: () => void) => () => {
    close(false);
    fn();
  };

  const items: { label: string; run: () => void; danger?: boolean }[] = [
    { label: "마감일 정하기", run: onDue },
    ...(onClearDue ? [{ label: "마감일 지우기", run: onClearDue }] : []),
    ...(canMove
      ? [
          { label: "위로", run: () => onMove("up") },
          { label: "아래로", run: () => onMove("down") },
        ]
      : []),
    { label: "삭제", run: onRemove, danger: true },
  ];

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`할 일 메뉴: ${task.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "grid size-7 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg",
          open ? "opacity-100" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
        )}
      >
        <span aria-hidden>⋯</span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`할 일 메뉴: ${task.title}`}
          onKeyDown={(e) => {
            const buttons = [
              ...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []),
            ];
            const i = buttons.indexOf(document.activeElement as HTMLElement);
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const step = e.key === "ArrowDown" ? 1 : -1;
              buttons[(i + step + buttons.length) % buttons.length]?.focus();
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close();
            } else if (e.key === "Tab") {
              close(false);
            }
          }}
          className="absolute top-full right-0 z-20 mt-1 flex min-w-36 flex-col rounded-lg border border-border bg-bg p-1 shadow-overlay"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={pick(item.run)}
              className={cn(
                "flex h-8 items-center rounded-md px-2 text-left text-[13px] hover:bg-hover focus:bg-hover",
                item.danger ? "text-danger" : "text-fg",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="currentColor">
      {[3, 6, 9].flatMap((y) =>
        [4.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" />),
      )}
    </svg>
  );
}
