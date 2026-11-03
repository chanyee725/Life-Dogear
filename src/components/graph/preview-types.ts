/** Response of `GET /graph/preview?node=<type>:<id>` (extra detail for the preview panel). */
export type NodePreview = {
  /** Badge text override, e.g. "연 목표 2027". */
  badge?: string;
  archived?: boolean;
  props: { label: string; value: string }[];
  summary?: string;
};
