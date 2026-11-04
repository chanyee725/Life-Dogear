"use client";

import { Input, type InputProps } from "./Input";

/**
 * Search box (`type="search"`, small by default). Escape clears a non-empty value
 * through `onClear` instead of bubbling (so it doesn't also close a surrounding panel).
 */
export function SearchInput({
  size = "sm",
  onClear,
  onKeyDown,
  ...props
}: InputProps & { onClear?: () => void }) {
  return (
    <Input
      type="search"
      autoComplete="off"
      size={size}
      onKeyDown={(e) => {
        if (onClear && e.key === "Escape" && e.currentTarget.value) {
          e.preventDefault();
          e.stopPropagation();
          onClear();
        }
        onKeyDown?.(e);
      }}
      {...props}
    />
  );
}
