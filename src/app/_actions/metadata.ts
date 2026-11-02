"use server";

import type { ActionResult } from "@/app/_actions/result";
import { lookupMetadata, metadataErrorMessage, type PaperMetadata } from "@/lib/metadata";
import { MAX_INPUT_LENGTH } from "@/lib/metadata/parse";

/**
 * "링크로 채우기": looks up a pasted DOI / arXiv link on Crossref or arXiv.
 * Runs on the server (fixed upstream hosts, no CORS); Next.js server actions
 * already reject cross-origin calls. The pasted value is never logged.
 */
export async function lookupPaperMetadata(input: unknown): Promise<ActionResult<PaperMetadata>> {
  if (typeof input !== "string" || input.length > MAX_INPUT_LENGTH) {
    return { ok: false, error: metadataErrorMessage("invalid_input") };
  }
  const result = await lookupMetadata(input);
  if (result.ok) return { ok: true, data: result.data };
  if (result.code !== "invalid_input" && result.code !== "not_found") {
    console.warn("[metadata] lookup failed", result.code, result.status ?? "");
  }
  return { ok: false, error: metadataErrorMessage(result.code) };
}
