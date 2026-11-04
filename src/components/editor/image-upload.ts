import type { Editor } from "@tiptap/core";
import { directUpload } from "@/lib/storage/direct-upload";
import { IMAGE_SNIFF_BYTES, IMAGE_TYPES, sniffImage } from "@/lib/storage/image-type";

const UNTYPED = new Set(["", "application/octet-stream"]);
const IMAGE_NAME_RE = /\.(jpe?g|png|gif|webp|hei[cf])$/i;

/**
 * Browser-side check before uploading; the server checks the bytes again. Some pastes (and
 * drops from a few apps) carry no type: those are taken when the name has no extension or
 * a photo one, and {@link uploadImage} reads the bytes to tell the type.
 */
export const isImageFile = (file: File): boolean =>
  file.type.startsWith("image/") ||
  (UNTYPED.has(file.type) && (!/\.[^./]+$/.test(file.name) || IMAGE_NAME_RE.test(file.name)));

const SIGNABLE: ReadonlySet<string> = new Set(Object.values(IMAGE_TYPES));

/**
 * The type to sign for a bucket upload: the browser's when it is one we store, otherwise
 * the one the first bytes show (HEIC and anything else unknown are refused here, with the
 * same messages the server uses).
 */
export async function imageUploadType(file: Blob): Promise<string> {
  const declared = file.type.trim().toLowerCase();
  if (SIGNABLE.has(declared)) return declared;
  const head = new Uint8Array(await file.slice(0, IMAGE_SNIFF_BYTES).arrayBuffer());
  const sniffed = sniffImage(head);
  if (sniffed === "heic") {
    throw new Error("HEIC 사진은 브라우저에서 보이지 않습니다. JPG로 바꿔서 올려 주세요.");
  }
  if (!sniffed) throw new Error("JPG·PNG·GIF·WebP 사진만 올릴 수 있습니다.");
  return IMAGE_TYPES[sniffed];
}

/**
 * Uploads one photo; resolves to its URL or rejects with a message for the user.
 * s3 mode: straight to the bucket (sign → PUT → confirm); local mode: through `/api/images`.
 */
export async function uploadImage(file: File): Promise<string> {
  const direct = await directUpload(
    { kind: "image", file, contentType: await imageUploadType(file) },
    "사진을 올리지 못했습니다.",
  );
  if (direct.mode === "s3") {
    if (!direct.data.url) throw new Error("사진을 올리지 못했습니다.");
    return direct.data.url;
  }
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
