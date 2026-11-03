/**
 * Hidden input of the focus picker: `type:id` refs joined by commas (empty = none).
 * Its own module so the client picker does not pull in the server-side form parser.
 */
export const FOCUS_FIELD = "focus";
