// Plain module (no "use client") so the server layout can inline the snippet.

/** localStorage key; value "collapsed" when the sidebar is hidden (focus mode). */
export const SIDEBAR_STORAGE_KEY = "rb-sidebar";
/** Attribute on <html>; `data-sidebar="collapsed"` hides the sidebar via CSS. */
export const SIDEBAR_ATTR = "data-sidebar";

/**
 * Inline <head> snippet: restores the collapsed state before first paint so the
 * sidebar never flashes. Appended to the theme init script.
 */
export const sidebarInitSnippet = `try{if(localStorage.getItem("${SIDEBAR_STORAGE_KEY}")==="collapsed")document.documentElement.setAttribute("${SIDEBAR_ATTR}","collapsed");}catch(e){}`;
