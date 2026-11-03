/** `Name` or `Name(code)`: never the message, which may hold paths, keys or endpoints. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" || typeof code === "number"
    ? `${error.name}(${code})`
    : error.name;
}
