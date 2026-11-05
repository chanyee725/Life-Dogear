// Plain module (no "use client") so the server layout can inline the snippet.

export type AccentPreference = "blue" | "terracotta";

/** localStorage key; absent or "blue" means the default blue accent. */
export const ACCENT_STORAGE_KEY = "rb-accent";
/** Attribute on <html>; globals.css swaps the --rb-accent* tokens on `terracotta`. */
export const ACCENT_ATTR = "data-accent";

/**
 * Inline <head> snippet: applies the saved accent before first paint so the colour
 * never flashes. Appended to the theme init script; keep in sync with applyAccent().
 */
export const accentInitSnippet = `try{if(localStorage.getItem("${ACCENT_STORAGE_KEY}")==="terracotta")document.documentElement.setAttribute("${ACCENT_ATTR}","terracotta");}catch(e){}`;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function parseAccent(value: string | null | undefined): AccentPreference {
  return value === "terracotta" ? "terracotta" : "blue";
}

export function readAccentPreference(storage = defaultStorage()): AccentPreference {
  try {
    return parseAccent(storage?.getItem(ACCENT_STORAGE_KEY));
  } catch {
    return "blue";
  }
}

export function saveAccentPreference(pref: AccentPreference, storage = defaultStorage()): void {
  try {
    if (pref === "blue") storage?.removeItem(ACCENT_STORAGE_KEY);
    else storage?.setItem(ACCENT_STORAGE_KEY, pref);
  } catch {
    // Storage unavailable (private mode): the choice simply isn't remembered.
  }
}

export function applyAccent(
  pref: AccentPreference,
  root: Pick<Element, "setAttribute" | "removeAttribute"> = document.documentElement,
): void {
  if (pref === "blue") root.removeAttribute(ACCENT_ATTR);
  else root.setAttribute(ACCENT_ATTR, pref);
}
