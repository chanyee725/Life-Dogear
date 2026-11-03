import type { Editor } from "@tiptap/core";

/** Browser-side check before uploading; the server checks the bytes again. */
export const isImageFile = (file: File): boolean => file.type.startsWith("image/");

/** Uploads one photo; resolves to its URL or rejects with a message for the user. */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  let response: Response;
  try {
    response = await fetch("/api/images", { method: "POST", body: form });
  } catch {
    throw new Error("사진을 올리지 못했습니다. 연결을 확인해 주세요.");
  }
  const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!response.ok || !data?.url) throw new Error(data?.error ?? "사진을 올리지 못했습니다.");
  return data.url;
}

/**
 * Uploads the photos and inserts them at `pos` (default: the cursor), in order.
 * Returns the error message of the first failure, or null.
 */
export async function insertImages(
  editor: Editor,
  files: readonly File[],
  pos?: number,
): Promise<string | null> {
  let at = pos;
  for (const file of files) {
    try {
      const src = await uploadImage(file);
      if (editor.isDestroyed) return null;
      const alt = file.name.replace(/\.[^.]+$/, "");
      const node = { type: "image", attrs: { src, alt } };
      const chain = editor.chain().focus();
      if (at === undefined) chain.insertContent(node).run();
      else {
        chain.insertContentAt(at, node).run();
        at = editor.state.selection.to;
      }
    } catch (error) {
      return error instanceof Error ? error.message : "사진을 올리지 못했습니다.";
    }
  }
  return null;
}
