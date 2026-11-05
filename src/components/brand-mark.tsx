import type { SVGProps } from "react";

/**
 * Life Dogear mark: a sheet whose top-right corner is folded down onto the
 * page (a dog-ear). The flap is filled so it reads as the paper's back side,
 * which also keeps it distinct from the outline-only PaperIcon in the nav.
 * Geometry is shared with src/app/icon.svg and src/app/apple-icon.tsx.
 */
export const BRAND_PAGE_PATH = "M5 2.75h6.25l4.75 4.75v9.25a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V3.25a.5.5 0 0 1 .5-.5Z";
export const BRAND_FLAP_PATH = "M11.25 2.75 16 7.5h-4.25a.5.5 0 0 1-.5-.5Z";

export function BrandMark({ size = 18, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={BRAND_PAGE_PATH} />
      <path d={BRAND_FLAP_PATH} fill="currentColor" />
    </svg>
  );
}
