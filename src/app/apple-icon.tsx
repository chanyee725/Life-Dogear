import { ImageResponse } from "next/og";
import { BRAND_FLAP_PATH, BRAND_PAGE_PATH } from "@/components/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: white dog-eared sheet on the accent color. */
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
          background: "#4f5bd5",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 20 20" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round">
          <path d={BRAND_PAGE_PATH} />
          <path d={BRAND_FLAP_PATH} fill="#ffffff" />
        </svg>
      </div>
    ),
    size,
  );
}
