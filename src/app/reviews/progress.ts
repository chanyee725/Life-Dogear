/** "지난 회고 대비" change, e.g. "+10", "−5", "0"; empty when either side is unknown. */
export function progressChange(
  now: number | null | undefined,
  before: number | null | undefined,
): string {
  if (now === null || now === undefined || before === null || before === undefined) return "";
  const d = Math.round(now - before);
  return d > 0 ? `+${d}` : d < 0 ? `−${-d}` : "0";
}
