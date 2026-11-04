"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { DateField } from "@/components/fields/DateField";
import { Button, Dialog, Field, Input, type ButtonSize } from "@/components/ui";
import type { CalendarItem } from "@/lib/calendar/types";
import { ADDED, checkEvent, EVENT_TITLE_MAX, postEvent, type AddEventInput } from "./add-event";

const TOAST_MS = 4000;

export type AddEventButtonProps = {
  /** `googleWrite` from `/api/calendar`; absent or false → disabled with "설정 필요". */
  enabled?: boolean;
  /** Day the form starts on (the selected day). */
  defaultDate: string;
  /** The created Google item, to show at once (the feed lags). */
  onAdded?: (item: CalendarItem) => void;
  size?: ButtonSize;
  className?: string;
};

/** '일정 추가' → small dialog (제목, 날짜, 시간) → `POST /api/calendar/events`. */
export function AddEventButton({
  enabled = false,
  defaultDate,
  onAdded,
  size = "sm",
  className,
}: AddEventButtonProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AddEventInput>({
    title: "",
    date: defaultDate,
    start: "",
    end: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<{ n: number; text: string }>({ n: 0, text: "" });
  const hideToast = useCallback(() => setToast((t) => ({ ...t, n: 0 })), []);
  const notify = (text: string) => setToast((t) => ({ n: t.n + 1, text }));

  const openForm = () => {
    setForm({ title: "", date: defaultDate, start: "", end: "" });
    setError(null);
    setOpen(true);
  };
  const set = (patch: Partial<AddEventInput>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const problem = checkEvent(form);
    if (problem) return setError(problem);
    setError(null);
    setPending(true);
    const result = await postEvent(form);
    setPending(false);
    if (result.ok) {
      onAdded?.(result.item);
      setOpen(false);
      notify(ADDED);
    } else {
      notify(result.message);
    }
  }

  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <Button
          size={size}
          className={className}
          disabled={!enabled}
          aria-describedby={enabled ? undefined : `${id}-off`}
          onClick={openForm}
          data-testid="add-event"
        >
          일정 추가
        </Button>
        {enabled ? null : (
          <span id={`${id}-off`} className="text-xs text-faint">
            설정 필요
          </span>
        )}
      </span>
      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title="Google 캘린더에 일정 추가"
      >
        <form id={`${id}-form`} onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <Field label="제목" htmlFor={`${id}-title`} error={error ?? undefined}>
            <Input
              id={`${id}-title`}
              value={form.title}
              maxLength={EVENT_TITLE_MAX}
              autoFocus
              onChange={(e) => set({ title: e.target.value })}
            />
          </Field>
          <Field label="날짜" htmlFor={`${id}-date`}>
            <DateField id={`${id}-date`} value={form.date} onChange={(date) => set({ date })} />
          </Field>
          <div className="flex gap-3">
            <Field label="시작" htmlFor={`${id}-start`} hint="비우면 종일" className="flex-1">
              <Input
                id={`${id}-start`}
                type="time"
                value={form.start}
                onChange={(e) => set({ start: e.target.value })}
              />
            </Field>
            <Field label="끝" htmlFor={`${id}-end`} hint="비우면 1시간" className="flex-1">
              <Input
                id={`${id}-end`}
                type="time"
                value={form.end}
                disabled={!form.start}
                onChange={(e) => set({ end: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "추가 중…" : "추가"}
            </Button>
          </div>
        </form>
      </Dialog>
      {toast.n ? <Toast key={toast.n} text={toast.text} onDone={hideToast} /> : null}
    </>
  );
}

function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-fg shadow-overlay"
    >
      {text}
    </div>
  );
}
