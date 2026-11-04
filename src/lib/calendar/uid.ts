/** Event UIDs only label item ids (`google:<uid>:<start>`); keep them short and plain. Pure. */
export function cleanUid(uid: unknown): string {
  const s = typeof uid === "string" ? uid.replace(/[^\w.@-]/g, "") : "";
  return s.slice(0, 200) || "event";
}
