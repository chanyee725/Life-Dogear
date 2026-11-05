"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ChangeEventHandler,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import {
  Select as SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/primitives/select";
import { cn } from "./cn";
import { controlClass, controlSize, type ControlSize } from "./Input";
import { openMotion } from "./Menu";

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size" | "onChange"> & {
  size?: ControlSize;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
};

type OptionDef = { value: string; label: ReactNode; disabled: boolean };

/** Radix items cannot carry `""`; `<option value="">` maps to this and back. */
const EMPTY = "__rc_empty__";
const toItem = (v: string) => (v === "" ? EMPTY : v);
const fromItem = (v: string) => (v === EMPTY ? "" : v);

/** `<option>` children (through fragments and arrays) as plain item definitions. */
export function collectOptions(children: ReactNode): OptionDef[] {
  const out: OptionDef[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: unknown; children?: ReactNode; disabled?: boolean }>(child))
      return;
    if (child.type === Fragment) {
      out.push(...collectOptions(child.props.children));
    } else if (child.type === "option") {
      const { value, children: label, disabled } = child.props;
      out.push({
        value: String(value ?? (typeof label === "string" ? label : "")),
        label,
        disabled: Boolean(disabled),
      });
    }
  });
  return out;
}

/** Native select's initial pick: `defaultValue`, else the first enabled option. */
function initialValue(defaultValue: SelectProps["defaultValue"], options: OptionDef[]): string {
  if (defaultValue !== undefined && defaultValue !== null) return String(defaultValue);
  return (options.find((o) => !o.disabled) ?? options[0])?.value ?? "";
}

/**
 * shadcn (Radix) Select behind the old native `<select>` API: `<option>` children,
 * `value`/`defaultValue`, `onChange(e)` with `e.target.value`, and `name` (a hidden input
 * carries the value into forms and fires a bubbling `change` so form-level listeners see edits).
 */
export function Select({
  className,
  children,
  size = "md",
  value,
  defaultValue,
  onChange,
  name,
  id,
  disabled,
  title,
  autoFocus,
  ...rest
}: SelectProps) {
  const options = collectOptions(children);
  const controlled = value !== undefined;
  const [inner, setInner] = useState(() => initialValue(defaultValue, options));
  const current = controlled ? String(value ?? "") : inner;
  const known = options.some((o) => o.value === current);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [edits, setEdits] = useState(0);

  useEffect(() => {
    if (edits) hiddenRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [edits]);

  const ariaProps = Object.fromEntries(
    Object.entries(rest).filter(([k]) => k.startsWith("aria-") || k.startsWith("data-")),
  );

  return (
    <>
      <SelectRoot
        value={known ? toItem(current) : ""}
        disabled={disabled}
        onValueChange={(item) => {
          const next = fromItem(item);
          if (!controlled) setInner(next);
          const target = { value: next, name: name ?? "" } as HTMLSelectElement;
          onChange?.({ target, currentTarget: target } as ChangeEvent<HTMLSelectElement>);
          setEdits((n) => n + 1);
        }}
      >
        <SelectTrigger
          id={id}
          title={title}
          autoFocus={autoFocus}
          {...ariaProps}
          className={cn(
            controlClass,
            "w-full cursor-pointer justify-between gap-1 py-0 pr-2 whitespace-nowrap data-[placeholder]:text-faint dark:bg-background dark:hover:bg-background [&>span]:truncate",
            controlSize[size],
            className,
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className={openMotion}>
          {options.map((o) => (
            <SelectItem
              key={o.value}
              value={toItem(o.value)}
              disabled={o.disabled}
              className="text-fg focus:bg-hover focus:text-fg"
            >
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
      <input ref={hiddenRef} type="hidden" name={name} value={current} />
    </>
  );
}
