import { cn } from "@/components/ui";
import {
  HIGHLIGHT_COLOR_LABEL,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_SWATCH,
  type HighlightColor,
} from "@/lib/highlights";

/** Row of colour buttons. `mousedown` is prevented so a text selection survives the click. */
export function ColorSwatches({
  value,
  onPick,
  disabled,
  labelPrefix = "",
}: {
  value?: HighlightColor;
  onPick: (color: HighlightColor) => void;
  disabled?: boolean;
  /** Prepended to each accessible label, e.g. "노랑으로 저장". */
  labelPrefix?: string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="색상">
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          disabled={disabled}
          aria-label={`${labelPrefix}${HIGHLIGHT_COLOR_LABEL[color]}`}
          aria-pressed={value === undefined ? undefined : value === color}
          title={HIGHLIGHT_COLOR_LABEL[color]}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(color)}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md hover:bg-hover disabled:opacity-50",
            value === color && "bg-hover",
          )}
        >
          <span
            className={cn("h-3.5 w-3.5 rounded-full", value === color && "ring-2 ring-ring")}
            style={{ background: HIGHLIGHT_SWATCH[color] }}
          />
        </button>
      ))}
    </div>
  );
}
