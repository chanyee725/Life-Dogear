import { dataDir } from "@/lib/data-dir";
import { blobStore, type StoreOptions } from "./blob";

/**
 * Photos pasted or dropped into a body: key `images/<uuid>.<ext>` in the {@link blobStore}
 * (local: `<DATA_DIR>/images/`), referenced from
 * Markdown as `![](/api/images/<uuid>.<ext>)`. The type comes from the file's bytes, never
 * from the browser; only raster formats browsers show (no SVG: it can carry scripts).
 */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export const IMAGE_TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
} as const;
export type ImageExt = keyof typeof IMAGE_TYPES;

/** Public URL prefix the image route serves. */
export const IMAGE_URL_PREFIX = "/api/images/";

const NAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/;

export class ImageStorageError extends Error {
  constructor(
    readonly code: "empty" | "too_large" | "not_image" | "heic",
    message: string,
  ) {
    super(message);
    this.name = "ImageStorageError";
  }
}

const startsWith = (bytes: Uint8Array, magic: number[], offset = 0) =>
  bytes.length >= offset + magic.length && magic.every((b, i) => bytes[offset + i] === b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Image type from magic bytes; "heic" for iPhone HEIC/HEIF (not shown by most browsers). */
export function sniffImage(bytes: Uint8Array): ImageExt | "heic" | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) return "gif";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "webp";
  if (startsWith(bytes, ascii("ftyp"), 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (/^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(brand)) return "heic";
  }
  return null;
}

/** True for names this module creates; anything else is never mapped to a path. */
export const isImageName = (name: string): boolean => NAME_RE.test(name);

export const imageDirSetting = (): string => `${dataDir()}/images`;

/** Storage key of a photo; throws for names this module did not create. */
export function imageKey(name: string): string {
  if (!isImageName(name)) throw new ImageStorageError("not_image", "잘못된 사진 이름입니다.");
  return `images/${name}`;
}

export function imageContentType(name: string): string {
  const ext = name.slice(name.lastIndexOf(".") + 1) as ImageExt;
  return IMAGE_TYPES[ext];
}

/** Checks and stores the bytes under a new name; returns the name. */
export async function writeImage(
  bytes: Uint8Array,
  options: StoreOptions & { maxBytes?: number } = {},
): Promise<string> {
  if (bytes.length === 0) throw new ImageStorageError("empty", "빈 파일입니다.");
  if (bytes.length > (options.maxBytes ?? MAX_IMAGE_BYTES)) {
    throw new ImageStorageError("too_large", "사진이 너무 큽니다 (최대 20MB).");
  }
  const type = sniffImage(bytes);
  if (type === "heic") {
    throw new ImageStorageError(
      "heic",
      "HEIC 사진은 브라우저에서 보이지 않습니다. JPG로 바꿔서 올려 주세요.",
    );
  }
  if (!type) throw new ImageStorageError("not_image", "JPG·PNG·GIF·WebP 사진만 올릴 수 있습니다.");

  const name = `${crypto.randomUUID()}.${type}`;
  await blobStore(options).put(imageKey(name), bytes, IMAGE_TYPES[type]);
  return name;
}

/** Size in bytes, or null when there is no such image. */
export async function imageSize(name: string, options: StoreOptions = {}) {
  return (await blobStore(options).head(imageKey(name)))?.size ?? null;
}

/** The photo's bytes and size, or null when it does not exist. */
export async function openImage(name: string, options: StoreOptions = {}) {
  const read = await blobStore(options).get(imageKey(name));
  return read && "body" in read ? { body: read.body, size: read.size } : null;
}
