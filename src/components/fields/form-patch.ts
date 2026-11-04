/**
 * Bridges plain HTML forms and patch-based autosave: the whole form is read as a
 * patch (the save queue drops unchanged fields), and a patch is turned back into
 * FormData for the existing server actions.
 */

export type FormPatch = Record<string, string | string[]>;

/** Fields that hold several values (one input per value), read with `getAll`. */
export const LIST_FIELDS = ["tags"] as const;

/**
 * Marker sent with a list field so the server can tell "cleared" (marker, no values)
 * from "not sent" (no marker). Example: `__present:tags`.
 */
export const presentMarker = (field: string) => `__present:${field}`;

/** True when the list field was sent (possibly empty). */
export function hasListField(form: FormData, field: string): boolean {
  return form.has(field) || form.has(presentMarker(field));
}

/** Reads every named field; list fields always become arrays. Files are skipped. */
export function formToPatch(
  form: FormData,
  listFields: readonly string[] = LIST_FIELDS,
): FormPatch {
  const patch: FormPatch = {};
  for (const field of listFields) {
    patch[field] = form.getAll(field).filter((v): v is string => typeof v === "string");
  }
  for (const [key, value] of form.entries()) {
    if (key.startsWith("__present:") || listFields.includes(key)) continue;
    if (typeof value === "string") patch[key] = value;
  }
  return patch;
}

/** Turns a patch back into FormData; list fields get their presence marker. */
export function patchToFormData(patch: FormPatch): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) {
      form.append(presentMarker(key), "1");
      for (const item of value) form.append(key, item);
    } else {
      form.append(key, value);
    }
  }
  return form;
}

/** Set on a form while autosave reads it, so fields can skip submit-only work. */
export const AUTOSAVE_READ_ATTR = "data-autosave-read";

/** Bubbling event the editor's hidden input fires once it holds the loaded content. */
export const EDITOR_READY_EVENT = "rb-editor-ready";

/** A text field as the page rendered it (`defaultValue`) and as it is now (`value`). */
export type RenderedField = {
  name: string;
  value: string;
  defaultValue: string;
  /** Single-line input: the browser strips line breaks from `value`, not `defaultValue`. */
  singleLine?: boolean;
};

const stripLineBreaks = (text: string) => text.replace(/[\r\n]/g, "");

/**
 * The server baseline from a form read on mount. Text typed before hydration is already
 * in the DOM then, so a plain read would take it for the server value and never save it:
 * fields whose value differs from the rendered `defaultValue` keep the rendered value in
 * the baseline and are reported as `edited`.
 */
export function baselineFromRendered(
  patch: FormPatch,
  fields: readonly RenderedField[],
): { baseline: FormPatch; edited: boolean } {
  const baseline: FormPatch = { ...patch };
  let edited = false;
  for (const f of fields) {
    const rendered = f.singleLine ? stripLineBreaks(f.defaultValue) : f.defaultValue;
    if (!f.name || f.value === rendered || typeof baseline[f.name] !== "string") continue;
    baseline[f.name] = rendered;
    edited = true;
  }
  return { baseline, edited };
}
