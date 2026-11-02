"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/components/ui/cn";
import { addTags } from "./tags";

export type TagInputProps = {
  /** Controlled tag names. Omit to let the component manage state from `defaultValue`. */
  value?: string[];
  defaultValue?: string[];
  onChange?: (names: string[]) => void;
  /** Existing tag names offered as autocomplete. */
  suggestions?: string[];
  /** For plain <form> use: one hidden input per tag with this name (`formData.getAll(name)`). */
  name?: string;
  id?: string;
  placeholder?: string;
  className?: string;
};

/** Tag chips + text box. Enter or comma adds, Backspace on an empty box removes the last tag. */
export function TagInput({
  value,
  defaultValue = [],
  onChange,
  suggestions = [],
  name,
  id,
  placeholder = "태그 추가",
  className,
}: TagInputProps) {
  const [internal, setInternal] = useState(defaultValue);
  const [draft, setDraft] = useState("");
  const tags = value ?? internal;
  const listId = useId();
  const inputId = id ?? `${listId}-input`;

  const inputRef = useRef<HTMLInputElement>(null);

  function update(next: string[]) {
    if (value === undefined) setInternal(next);
    onChange?.(next);
    // Removing a chip is a click, not typing; tell the surrounding form it changed.
    inputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // On submit (button or Cmd+S), include a typed-but-uncommitted tag and commit it.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!name || !form) return;
    const onFormData = (event: FormDataEvent) => {
      if (!draft.trim()) return;
      const next = addTags(tags, draft);
      event.formData.delete(name);
      for (const tag of next) event.formData.append(name, tag);
      if (value === undefined) setInternal(next);
      onChange?.(next);
      setDraft("");
    };
    form.addEventListener("formdata", onFormData);
    return () => form.removeEventListener("formdata", onFormData);
  }, [name, draft, tags, value, onChange]);

  function commit() {
    if (!draft.trim()) return;
    update(addTags(tags, draft));
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      update(tags.slice(0, -1));
    }
  }

  const lowered = new Set(tags.map((t) => t.toLowerCase()));
  const available = suggestions.filter((s) => !lowered.has(s.toLowerCase()));

  return (
    <div
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border border-border bg-bg px-2 py-1 transition-colors hover:border-border-strong focus-within:border-accent focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex h-6 items-center gap-1 rounded-md bg-subtle pr-1 pl-2 text-[13px] text-fg"
        >
          {tag}
          <button
            type="button"
            aria-label={`${tag} 태그 삭제`}
            onClick={() => update(tags.filter((t) => t !== tag))}
            className="flex h-4 w-4 items-center justify-center rounded text-muted hover:bg-hover hover:text-fg"
          >
            ×
          </button>
          {name ? <input type="hidden" name={name} value={tag} /> : null}
        </span>
      ))}
      <input
        ref={inputRef}
        id={inputId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        list={available.length > 0 ? listId : undefined}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm text-fg placeholder:text-faint focus:outline-none [&::-webkit-calendar-picker-indicator]:hidden"
      />
      {available.length > 0 ? (
        <datalist id={listId}>
          {available.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}
