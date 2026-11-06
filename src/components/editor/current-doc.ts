"use client";

import { createContext, useContext } from "react";
import type { ItemRef } from "@/lib/repo/shared";

/**
 * The saved item whose body the surrounding editor edits, or null (new-item forms, lists).
 * Provided by MarkdownEditor; read by `[[…]]` suggestions, wiki-link "create" and the
 * rename prompt instead of parsing the URL (detail URLs are `<slug>-<shortid>` now).
 */
export const CurrentDocContext = createContext<ItemRef | null>(null);

export const useCurrentDoc = () => useContext(CurrentDocContext);
