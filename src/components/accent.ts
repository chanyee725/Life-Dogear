// Plain module (no "use client") so the server layout can inline the snippet.
// The accent is fixed to mono (the :root tokens in globals.css); there is no switch.

/** Legacy localStorage key from the old accent switcher; removed on load. */
export const LEGACY_ACCENT_STORAGE_KEY = "rb-accent";

/**
 * Inline <head> snippet: drops the old saved accent so stale values never matter.
 * Appended to the theme init script.
 */
export const accentInitSnippet = `try{localStorage.removeItem("${LEGACY_ACCENT_STORAGE_KEY}");}catch(e){}`;
