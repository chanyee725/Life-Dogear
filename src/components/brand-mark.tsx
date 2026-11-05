import type { SVGProps } from "react";

/**
 * Life Dogear mark: a solid sheet whose top-right corner is folded down onto
 * the page (a dog-ear). The flap is drawn in a lighter tone of the same color
 * (the paper's back side), and a small gap between flap and sheet reads as the
 * crease shadow. Everything is currentColor, so it follows light/dark themes.
 * Geometry is shared with src/app/icon.svg and src/app/apple-icon.tsx.
 */
export const BRAND_VIEWBOX = "0 0 32 32";
export const BRAND_PAGE_PATH = "M8.5 3H15.5V12.5H25.5V27A2 2 0 0 1 23.5 29H8.5A2 2 0 0 1 6.5 27V5A2 2 0 0 1 8.5 3Z";
export const BRAND_FLAP_PATH = "M17 3L25.5 11.5H18A1 1 0 0 1 17 10.5Z";
export const BRAND_FLAP_OPACITY = 0.45;

export function BrandMark({ size = 18, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={BRAND_VIEWBOX}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={BRAND_PAGE_PATH} />
      <path d={BRAND_FLAP_PATH} opacity={BRAND_FLAP_OPACITY} />
    </svg>
  );
}
