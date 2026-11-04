import { NextResponse } from "next/server";
import { describeError } from "@/app/_actions/result";
import { imageContentType, imageKey, isImageName, openImage } from "@/lib/storage/images";
import { presignedReadUrl, redirectTo } from "@/lib/storage/read-url";
import { jsonError } from "../../papers/_lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMMUTABLE = "private, max-age=31536000, immutable";

/**
 * Serves a stored photo. Names are random and never reused, so it caches for good.
 * s3 mode: redirects to a 5-minute presigned GET (type and caching fixed by the URL); the
 * redirect itself is cached for 4 minutes so a reloaded note does not ask again.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!isImageName(name)) return jsonError(400, "잘못된 사진 이름입니다.");
  try {
    const url = await presignedReadUrl(imageKey(name), {
      contentType: imageContentType(name),
      contentDisposition: "inline",
      cacheControl: IMMUTABLE,
    });
    if (url) return redirectTo(url, 240);
    const image = await openImage(name);
    if (!image) return jsonError(404, "사진을 찾을 수 없습니다.");
    return new NextResponse(image.body, {
      headers: {
        "Content-Type": imageContentType(name),
        ...(image.size ? { "Content-Length": String(image.size) } : {}),
        "Cache-Control": IMMUTABLE,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
    });
  } catch (error) {
    console.error("[api/images]", describeError(error));
    return jsonError(500, "사진을 불러오지 못했습니다.");
  }
}
