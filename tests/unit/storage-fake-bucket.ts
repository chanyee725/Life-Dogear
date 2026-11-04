import { vi } from "vitest";
import { S3BlobStore, type S3Config } from "@/lib/storage/blob";

export const CONFIG: S3Config = {
  endpoint: "https://acct.r2.example.com",
  bucket: "rb-files",
  accessKeyId: "AKIDTEST",
  secretAccessKey: "secret-test-key",
  region: "auto",
};
export const ENV = {
  S3_ENDPOINT: CONFIG.endpoint,
  S3_BUCKET: CONFIG.bucket,
  S3_ACCESS_KEY_ID: CONFIG.accessKeyId,
  S3_SECRET_ACCESS_KEY: CONFIG.secretAccessKey,
};
export const IMG = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b.png";
export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

/** In-memory bucket answering the requests the store sends. */
export function fakeBucket(initial: Record<string, string | Uint8Array> = {}) {
  const objects = new Map<string, Uint8Array>(
    Object.entries(initial).map(([k, v]) => [
      k,
      typeof v === "string" ? new TextEncoder().encode(v) : v,
    ]),
  );
  const types = new Map<string, string>();
  const requests: Request[] = [];
  let ignoreRange = false;
  const fetchImpl = vi.fn(async (request: Request) => {
    requests.push(request.clone());
    const url = new URL(request.url);
    const prefix = `/${CONFIG.bucket}/`;
    if (url.pathname === `/${CONFIG.bucket}` && request.method === "GET") {
      const p = url.searchParams.get("prefix") ?? "";
      const keys = [...objects.keys()].filter((k) => k.startsWith(p)).sort();
      const token = Number(url.searchParams.get("continuation-token") ?? 0);
      const page = keys.slice(token, token + 1);
      const more = token + 1 < keys.length;
      const xml = `<?xml version="1.0"?><ListBucketResult><IsTruncated>${more}</IsTruncated>${
        more ? `<NextContinuationToken>${token + 1}</NextContinuationToken>` : ""
      }${page
        .map(
          (k) =>
            `<Contents><Key>${k}</Key><LastModified>2026-11-01T00:00:00.000Z</LastModified><Size>${objects.get(k)!.length}</Size></Contents>`,
        )
        .join("")}</ListBucketResult>`;
      return new Response(xml, { status: 200 });
    }
    const key = url.pathname.slice(prefix.length);
    const data = objects.get(key);
    switch (request.method) {
      case "PUT": {
        const source = request.headers.get("x-amz-copy-source");
        if (source) {
          const from = objects.get(source.slice(prefix.length));
          if (!from) return new Response("<Error><Code>NoSuchKey</Code></Error>", { status: 404 });
          objects.set(key, from);
          types.set(key, request.headers.get("content-type") ?? "");
          return new Response("<CopyObjectResult><ETag>x</ETag></CopyObjectResult>");
        }
        objects.set(key, new Uint8Array(await request.arrayBuffer()));
        types.set(key, request.headers.get("content-type") ?? "");
        return new Response(null, { status: 200 });
      }
      case "DELETE":
        objects.delete(key);
        return new Response(null, { status: 204 });
      case "HEAD":
        if (!data) return new Response(null, { status: 404 });
        return new Response(null, {
          status: 200,
          headers: {
            "content-length": String(data.length),
            "last-modified": "Sun, 01 Nov 2026 00:00:00 GMT",
          },
        });
      case "GET": {
        if (!data) return new Response("<Error><Code>NoSuchKey</Code></Error>", { status: 404 });
        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
        if (range && !ignoreRange) {
          const n = data.length;
          const [start, end] = range[1]
            ? [Number(range[1]), range[2] ? Math.min(Number(range[2]), n - 1) : n - 1]
            : [Math.max(0, n - Number(range[2])), n - 1];
          if (start >= n) {
            return new Response(null, {
              status: 416,
              headers: { "content-range": `bytes */${n}` },
            });
          }
          return new Response(data.slice(start, end + 1), {
            status: 206,
            headers: { "content-range": `bytes ${start}-${end}/${data.length}` },
          });
        }
        return new Response(data as Uint8Array<ArrayBuffer>, {
          status: 200,
          headers: { "content-length": String(data.length) },
        });
      }
    }
    return new Response(null, { status: 405 });
  });
  return {
    objects,
    types,
    requests,
    fetchImpl,
    store: new S3BlobStore(CONFIG, fetchImpl),
    ignoreRanges: () => {
      ignoreRange = true;
    },
  };
}
