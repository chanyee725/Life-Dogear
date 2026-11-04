"use client";

import { useRef, useState } from "react";
import { Button, Input } from "@/components/ui";

type AuthorsFieldProps = {
  id?: string;
  defaultValue?: string[];
  /** Plain-form use: one input per author with this name (`formData.getAll(name)`). */
  name?: string;
  /** Called when the list changes (after blur or add/remove), with empty rows dropped. */
  onCommit?: (authors: string[]) => void;
};

type Row = { key: number; value: string };

/** One text box per author (names may contain commas, e.g. "Kim, J."). */
export function AuthorsField({ id, defaultValue = [], name, onCommit }: AuthorsFieldProps) {
  const nextKey = useRef(0);
  const makeRow = (value: string): Row => ({ key: nextKey.current++, value });
  const [rows, setRows] = useState<Row[]>(() =>
    (defaultValue.length ? defaultValue : [""]).map(makeRow),
  );
  const inputs = useRef(new Map<number, HTMLInputElement>());

  const clean = (list: Row[]) => list.map((r) => r.value.trim()).filter(Boolean);

  function commit(list: Row[] = rows) {
    onCommit?.(clean(list));
  }

  function addRow(after?: number) {
    const row = makeRow("");
    setRows((prev) => {
      const index = after === undefined ? prev.length : prev.findIndex((r) => r.key === after) + 1;
      return [...prev.slice(0, index), row, ...prev.slice(index)];
    });
    requestAnimationFrame(() => inputs.current.get(row.key)?.focus());
  }

  function removeRow(key: number) {
    const next = rows.filter((r) => r.key !== key);
    const list = next.length ? next : [makeRow("")];
    setRows(list);
    commit(list);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row, index) => (
        <div key={row.key} className="flex items-center gap-1.5">
          <Input
            id={index === 0 ? id : undefined}
            ref={(el) => {
              if (el) inputs.current.set(row.key, el);
              else inputs.current.delete(row.key);
            }}
            name={name}
            value={row.value}
            placeholder={index === 0 ? "예: Kim, J." : "저자 이름"}
            aria-label={`저자 ${index + 1}`}
            onChange={(e) => {
              const value = e.target.value;
              setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, value } : r)));
            }}
            onBlur={() => commit()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                addRow(row.key);
              }
            }}
          />
          {rows.length > 1 || row.value ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`저자 ${index + 1} 빼기`}
              onClick={() => removeRow(row.key)}
            >
              ×
            </Button>
          ) : null}
        </div>
      ))}
      <div>
        <Button variant="ghost" size="sm" onClick={() => addRow()}>
          + 저자 추가
        </Button>
      </div>
    </div>
  );
}
