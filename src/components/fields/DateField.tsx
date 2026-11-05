"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { CalendarIcon } from "lucide-react";
import { ko } from "react-day-picker/locale";
import { controlClass } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import { formatDate } from "@/components/ui/format";
import { Calendar } from "@/components/ui/primitives/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/primitives/popover";
import { dateToIso, isoToDate, parseDateInput } from "./date-input";

export type DateFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  /** `YYYY-MM-DD`, or "" / null for empty. */
  value?: string | null;
  defaultValue?: string | null;
  /** Receives `YYYY-MM-DD`, or "" when cleared. */
  onChange?: (value: string) => void;
};

/**
 * Date field that shows `YYYY.MM.DD` (like every other date in the app) and speaks plain
 * `YYYY-MM-DD` strings. Type the date (`2026.11.04`, `2026-11-04`, `20261104`) or pick it
 * from the calendar button; clear the text to clear the date. With `name`, a hidden input
 * carries the ISO value into the form.
 */
export function DateField({
  value,
  defaultValue,
  onChange,
  className,
  name,
  disabled,
  onBlur,
  onKeyDown,
  ...props
}: DateFieldProps) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const iso = controlled ? (value ?? "") : internal;
  const [text, setText] = useState(() => formatDate(iso));
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Bumped on a calendar pick: once the hidden input holds the new value, tell the form.
  const [picked, setPicked] = useState(0);

  // An outside change (parent value, a pick) shows up in the text unless it already says so.
  useEffect(() => {
    setText((current) => (parseDateInput(current, true) === iso ? current : formatDate(iso)));
  }, [iso]);

  useEffect(() => {
    if (picked) inputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [picked]);

  function commit(next: string) {
    if (next === iso) return;
    if (!controlled) setInternal(next);
    onChange?.(next);
  }

  /** Blur / Enter: take a loosely typed date, else put back the last good one. */
  function settle() {
    const parsed = parseDateInput(text, true);
    if (parsed !== null) commit(parsed);
    setText(formatDate(parsed ?? iso));
  }

  const selected = isoToDate(iso);

  return (
    <div className={cn("relative inline-flex w-auto min-w-40", className)}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="YYYY.MM.DD"
        value={text}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseDateInput(e.target.value);
          if (parsed !== null) commit(parsed);
        }}
        onBlur={(e) => {
          settle();
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") settle();
          onKeyDown?.(e);
        }}
        className={cn(controlClass, "h-9 pr-9 tabular-nums")}
        {...props}
      />
      {name ? <input type="hidden" name={name} value={iso} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="달력에서 고르기"
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarIcon className="size-4" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-auto p-0"
          // Back to the text, not the button, so typing can go on.
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          // Esc closes only the calendar, not a popover the field sits in.
          onKeyDown={(e) => {
            if (e.key === "Escape") e.stopPropagation();
          }}
        >
          <Calendar
            mode="single"
            locale={ko}
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              if (date) {
                commit(dateToIso(date));
                setPicked((n) => n + 1);
              }
              setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
