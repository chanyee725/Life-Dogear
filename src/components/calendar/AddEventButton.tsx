"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState, type FormEvent } from "react";
import { DateField } from "@/components/fields/DateField";
import { Button, Dialog, Field, Input, Toast, type ButtonSize } from "@/components/ui";
import type { CalendarItem } from "@/lib/calendar/types";
import {
  ADDED,
  checkEvent,
  EVENT_TITLE_MAX,
  eventPayload,
  newClientId,
  postEvent,
  timeProblem,
  type AddEventInput,
} from "./add-event";

const TOAST_MS = 4000;

/** What the user reads (screen readers get it as the button's description). */
const OFF_HINT = "Google 캘린더 연결이 필요해요";
/** Where the write connection is explained (status, what the server needs). */
export const SETTINGS_HREF = "/settings#calendar-write";

export type AddEventButtonProps = {
  /** `googleWrite` from `/api/calendar`; absent or false → disabled with "Google 캘린더 연결이 필요해요". */
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
  /** Event id per payload: the same form retried keeps it, an edited form gets a new one. */
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  const [toast, setToast] = useState<{ n: number; text: string }>({ n: 0, text: "" });
  const hideToast = useCallback(() => setToast((t) => ({ ...t, n: 0 })), []);
  const notify = (text: string) => setToast((t) => ({ n: t.n + 1, text }));

  const openForm = () => {
    setForm({ title: "", date: defaultDate, start: "", end: "" });
    setError(null);
    setOpen(true);
  };
  const set = (patch: Partial<AddEventInput>) => setForm((f) => ({ ...f, ...patch }));
  const timeError = timeProblem(form);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const problem = checkEvent(form);
    if (problem) return setError(problem === timeError ? null : problem);
    setError(null);
    setPending(true);
    const payload = JSON.stringify(eventPayload(form));
    if (attempt.current?.payload !== payload) attempt.current = { payload, id: newClientId() };
    const result = await postEvent(form, { clientId: attempt.current.id });
    // Done, or the id itself was refused (e.g. a deleted event's): the next try needs a new one.
    if (result.ok || result.code === "invalid") attempt.current = null;
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
      <span className="inline-flex items-center gap-2">
        <Button
          variant="secondary"
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
          <>
            <span id={`${id}-off`} className="sr-only">
              {OFF_HINT}
            </span>
            <Link
              href={SETTINGS_HREF}
              className="text-[13px] text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              설정 필요
            </Link>
          </>
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
            <Field
              label="끝"
              htmlFor={`${id}-end`}
              hint="비우면 1시간"
              error={timeError ?? undefined}
              className="flex-1"
            >
              <Input
                id={`${id}-end`}
                type="time"
                value={form.end}
                disabled={!form.start}
                aria-invalid={timeError ? true : undefined}
                onChange={(e) => set({ end: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button type="submit" variant="primary" disabled={pending || !!timeError}>
              {pending ? "추가 중…" : "추가"}
            </Button>
          </div>
        </form>
      </Dialog>
      {toast.n ? (
        <Toast key={toast.n} ms={TOAST_MS} onDone={hideToast}>
          {toast.text}
        </Toast>
      ) : null}
    </>
  );
}
