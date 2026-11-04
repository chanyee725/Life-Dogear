/**
 * Photo types the app stores, read from magic bytes. Browser-safe (no server imports), so
 * the editor can name the type of a pasted photo whose `File.type` is empty.
 */
export const IMAGE_TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
} as const;
export type ImageExt = keyof typeof IMAGE_TYPES;

/** Bytes needed to tell every type below apart. */
export const IMAGE_SNIFF_BYTES = 16;

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
