import { ImageResponse } from "next/og";
import { BRAND_FLAP_PATH, BRAND_PAGE_PATH, BRAND_VIEWBOX } from "@/components/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Home-screen icon: the two-tone dog-eared sheet in warm paper (#f7f6f3) on
 * warm black (#2f2e2a). The flap color is the paper tone at 45% over the
 * background, baked to a hex because the PNG has no theme.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2f2e2a",
        }}
      >
        <svg width="120" height="120" viewBox={BRAND_VIEWBOX} fill="#f7f6f3">
          <path d={BRAND_PAGE_PATH} />
          <path d={BRAND_FLAP_PATH} fill="#898884" />
        </svg>
      </div>
    ),
    size,
  );
}
