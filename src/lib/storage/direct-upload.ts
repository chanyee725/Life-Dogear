/**
 * Browser side of direct uploads (see `uploads.ts`): ask the server to sign, PUT the file to
 * the bucket, then confirm. When the server stores files locally it answers `mode: "local"`
 * and the caller uses its regular upload route instead. Browser-safe: no server imports.
 * Errors are thrown as Korean messages for the user; URLs are never logged.
 */

export type DirectUploadRequest = {
  kind: "image" | "pdf";
  file: Blob;
  contentType: string;
  /** Paper id for PDFs. */
  target?: string;
};

export type DirectUploadResult =
  { mode: "local" } | { mode: "s3"; data: { url?: string; pdfPath?: string } };

type Fetch = typeof fetch;

/** Remembered after the first answer: the storage mode does not change while the app runs. */
let localMode = false;

/** Tests only. */
export function resetDirectUploadMode(): void {
  localMode = false;
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : fallback;
}

const postJson = (fetchImpl: Fetch, url: string, body: unknown) =>
  fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export async function directUpload(
  request: DirectUploadRequest,
  fallback: string,
  fetchImpl: Fetch = fetch,
): Promise<DirectUploadResult> {
  if (localMode) return { mode: "local" };
  const offline = `${fallback} 연결을 확인해 주세요.`;

  let sign: Response;
  try {
    sign = await postJson(fetchImpl, "/api/uploads/sign", {
      kind: request.kind,
      size: request.file.size,
      contentType: request.contentType,
      ...(request.target ? { target: request.target } : {}),
    });
  } catch {
    throw new Error(offline);
  }
  if (!sign.ok) throw new Error(await errorMessage(sign, fallback));
  const signed = (await sign.json().catch(() => null)) as {
    mode?: string;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    token?: string;
  } | null;
  if (signed?.mode === "local") {
    localMode = true;
    return { mode: "local" };
  }
  if (signed?.mode !== "s3" || !signed.url || !signed.token) throw new Error(fallback);

  let put: Response;
  try {
    put = await fetchImpl(signed.url, {
      method: signed.method ?? "PUT",
      headers: signed.headers,
      body: request.file,
    });
  } catch {
    // Network failure or a bucket without the CORS rule (the browser hides which).
    throw new Error(offline);
  }
  if (!put.ok) throw new Error(fallback);

  let confirm: Response;
  try {
    confirm = await postJson(fetchImpl, "/api/uploads/confirm", { token: signed.token });
  } catch {
    throw new Error(offline);
  }
  if (!confirm.ok) throw new Error(await errorMessage(confirm, fallback));
  const data = (await confirm.json().catch(() => null)) as {
    url?: string;
    pdfPath?: string;
  } | null;
  if (!data) throw new Error(fallback);
  return { mode: "s3", data };
}
