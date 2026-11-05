"use client";

import type { ComponentProps } from "react";
import { Switch as SwitchPrimitive } from "./primitives/switch";

/**
 * Radix switch (`role="switch"` button) for an on/off setting that applies at once. Name it
 * with `aria-label`, or wrap it in a `<label>` with the text.
 */
export function Switch({
  ...props
}: Omit<ComponentProps<typeof SwitchPrimitive>, "checked"> & { checked: boolean }) {
  return <SwitchPrimitive {...props} />;
}
