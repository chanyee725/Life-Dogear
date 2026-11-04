import { createReadStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { AwsClient } from "aws4fetch";
import { dataDir, type Env } from "@/lib/data-dir";
import { describeError } from "./describe-error";
import { rangeHeader, resolveRange, type ByteRange, type RangeSpec } from "./range";

/**
 * Where uploaded files live. Keys are `images/<name>` and `pdfs/<id>.pdf`, plus
 * `pending/<uuid>` for browser uploads to the bucket that are not confirmed yet.
 * - `local`: files under `DATA_DIR` (`<DATA_DIR>/images/<name>`, `<DATA_DIR>/pdfs/<id>.pdf`).
 * - `s3`: an S3-compatible bucket (Cloudflare R2), used when all four `S3_*` settings are
 *   present, so PCs sharing one Turso database also share the files. Reads fall back to the
 *   local folder for files uploaded before the bucket was set up.
 * Local mode proxies the bytes through the API routes. In s3 mode browsers upload and read
 * through short-lived presigned URLs ({@link S3BlobStore.presign}); credentials stay on the
 * server.
 */
export type BlobInfo = {
  size: number;
  lastModified: Date | null;
  /** Bucket entity tag (s3 HEAD only), to pin later reads and copies to this version. */
  etag?: string;
};
export type BlobEntry = BlobInfo & { key: string };
export type BlobRead = {
  /** Whole file size; null when the bucket did not say. */
  size: number | null;
  lastModified: Date | null;
  body: ReadableStream<Uint8Array>;
  /** Present when only part of the file is returned (size is then always known). */
  range?: ByteRange;
};
/** The requested range starts past the end of the file (HTTP 416). */
export type BlobUnsatisfiable = { unsatisfiable: true; size: number };

export interface BlobStore {
  readonly kind: "local" | "s3";
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /**
   * The file, or the part a range asks for (resolved against the real size, so a bucket
   * needs one request); null when missing.
   */
  get(key: string, range?: RangeSpec): Promise<BlobRead | BlobUnsatisfiable | null>;
  head(key: string): Promise<BlobInfo | null>;
  /** False when there was nothing to delete. */
  delete(key: string): Promise<boolean>;
  /** Every file whose key starts with `prefix` (`images/`, `pdfs/` or `pending/`). */
  list(prefix: string): Promise<BlobEntry[]>;
}

/** Errors carry a short code only: never the endpoint, bucket, key or credentials. */
export class BlobStoreError extends Error {
  constructor(
    readonly code: string,
    message = "저장소 오류",
  ) {
    super(message);
    this.name = "BlobStoreError";
  }
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY_RE = new RegExp(`^(?:(?:images|pdfs)/[A-Za-z0-9][A-Za-z0-9._-]{0,127}|pending/${UUID})$`);
const PREFIX_RE = /^(images|pdfs|pending)\/$/;
const PENDING_RE = new RegExp(`^pending/${UUID}$`);

/** Keys this app creates; anything else is rejected before touching disk or network. */
export function assertKey(key: string): void {
  if (!KEY_RE.test(key) || key.includes("..")) throw new BlobStoreError("invalid_key");
}

/** A fresh key for a browser upload that is not confirmed yet. */
export const newPendingKey = (): string => `pending/${crypto.randomUUID()}`;
export const isPendingKey = (key: unknown): key is string =>
  typeof key === "string" && PENDING_RE.test(key);

/** Presigned URLs live this long (seconds): enough to start an upload or a read. */
export const PRESIGN_TTL_SECONDS = 300;

export type PresignOptions = {
  method: "GET" | "PUT";
  expiresIn?: number;
  /** PUT: signed, so the browser must send exactly this type and byte count. */
  contentType?: string;
  contentLength?: number;
  /** GET: response headers the bucket must send (`response-content-type` and friends). */
  response?: { contentType?: string; contentDisposition?: string; cacheControl?: string };
  /** Signing time (tests). */
  now?: Date;
};
function assertPrefix(prefix: string): void {
  if (!PREFIX_RE.test(prefix)) throw new BlobStoreError("invalid_prefix");
}

const isNotFound = (error: unknown) =>
  (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";

// --- local ----------------------------------------------------------------------------------

export class LocalBlobStore implements BlobStore {
  readonly kind = "local";
  /** `root` is the project root (tests pass a temp dir); DATA_DIR is read per call. */
  constructor(private readonly root: string = process.cwd()) {}

  private dir(): string {
    return resolve(this.root, dataDir());
  }
  path(key: string): string {
    assertKey(key);
    // Temporary upload objects exist only in the bucket.
    if (isPendingKey(key)) throw new BlobStoreError("invalid_key");
    return join(this.dir(), key);
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    const temp = `${target}.${crypto.randomUUID()}.tmp`;
    try {
      await writeFile(temp, bytes, { flag: "wx" });
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }

  async head(key: string): Promise<BlobInfo | null> {
    try {
      const info = await stat(this.path(key));
      return info.isFile() ? { size: info.size, lastModified: info.mtime } : null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async get(key: string, spec?: RangeSpec): Promise<BlobRead | BlobUnsatisfiable | null> {
    const info = await this.head(key);
    if (!info) return null;
    const range = spec && resolveRange(spec, info.size);
    if (range === "unsatisfiable") return { unsatisfiable: true, size: info.size };
    const stream = createReadStream(this.path(key), range);
    return {
      ...info,
      body: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
      ...(range ? { range } : {}),
    };
  }

  async delete(key: string): Promise<boolean> {
    if (!(await this.head(key))) return false;
    await rm(this.path(key), { force: true });
    return true;
  }

  async list(prefix: string): Promise<BlobEntry[]> {
    assertPrefix(prefix);
    if (prefix === "pending/") return [];
    const dir = join(this.dir(), prefix);
    let names: string[];
    try {
      names = await readdir(dir);
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
    const entries: BlobEntry[] = [];
    for (const name of names.sort()) {
      const key = `${prefix}${name}`;
      if (!KEY_RE.test(key) || name.endsWith(".tmp")) continue;
      const info = await this.head(key);
      if (info) entries.push({ key, ...info });
    }
    return entries;
  }
}

// --- s3 -------------------------------------------------------------------------------------

export type S3Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

/**
 * S3 settings when all four required values are set, else null. `BLOB_STORE=local` forces
 * local files (e2e runs use it so they never write to the shared bucket).
 */
export function s3ConfigFromEnv(env: Env = process.env): S3Config | null {
  if (env.BLOB_STORE?.trim() === "local") return null;
  const endpoint = env.S3_ENDPOINT?.trim();
  const bucket = env.S3_BUCKET?.trim();
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    accessKeyId,
    secretAccessKey,
    region: env.S3_REGION?.trim() || "auto",
  };
}

type FetchLike = (request: Request) => Promise<Response>;

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
const xmlTag = (xml: string, tag: string) =>
  new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml)?.[1];

/** Path-style requests (`<endpoint>/<bucket>/<key>`), signed with SigV4 by aws4fetch. */
export class S3BlobStore implements BlobStore {
  readonly kind = "s3";
  private readonly client: AwsClient;
  private readonly base: string;
  private readonly bucket: string;

  constructor(
    config: S3Config,
    private readonly fetchImpl: FetchLike = (request) => fetch(request),
  ) {
    let url: URL;
    try {
      url = new URL(config.endpoint);
    } catch {
      throw new BlobStoreError("invalid_endpoint");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new BlobStoreError("invalid_endpoint");
    }
    if (!/^[a-z0-9][a-z0-9.-]{1,62}$/.test(config.bucket)) {
      throw new BlobStoreError("invalid_bucket");
    }
    this.bucket = config.bucket;
    this.base = `${url.origin}${url.pathname.replace(/\/+$/, "")}/${config.bucket}`;
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: "s3",
      region: config.region,
      retries: 0,
    });
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    const signed = await this.client.sign(url, init);
    return this.fetchImpl(signed);
  }

  private url(key: string): string {
    assertKey(key);
    return `${this.base}/${key}`;
  }

  /**
   * A URL the browser can use for one method on one key until it expires
   * ({@link PRESIGN_TTL_SECONDS} by default). It carries the access key id and a signature,
   * never the secret. Do not log it.
   */
  async presign(key: string, options: PresignOptions): Promise<string> {
    const url = new URL(this.url(key));
    const expiresIn = options.expiresIn ?? PRESIGN_TTL_SECONDS;
    if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 3600) {
      throw new BlobStoreError("invalid_expiry");
    }
    url.searchParams.set("X-Amz-Expires", String(expiresIn));
    const response = options.response ?? {};
    if (response.contentType) url.searchParams.set("response-content-type", response.contentType);
    if (response.contentDisposition) {
      url.searchParams.set("response-content-disposition", response.contentDisposition);
    }
    if (response.cacheControl)
      url.searchParams.set("response-cache-control", response.cacheControl);
    const headers: Record<string, string> = {};
    if (options.method === "PUT") {
      if (!options.contentType || !options.contentLength) throw new BlobStoreError("invalid_put");
      headers["content-type"] = options.contentType;
      headers["content-length"] = String(options.contentLength);
    }
    const signed = await this.client.sign(url.toString(), {
      method: options.method,
      headers,
      aws: {
        signQuery: true,
        // Sign Content-Type and Content-Length too (aws4fetch skips them by default).
        allHeaders: true,
        ...(options.now
          ? { datetime: options.now.toISOString().replace(/[:-]|\.\d{3}/g, "") }
          : {}),
      },
    });
    return signed.url;
  }

  /**
   * Server-side copy inside the bucket (no bytes pass through this server). `ifMatch` makes
   * the bucket refuse (412) when the source changed since it was checked.
   */
  async copy(
    from: string,
    to: string,
    contentType: string,
    options: { ifMatch?: string } = {},
  ): Promise<void> {
    assertKey(from);
    const headers: Record<string, string> = {
      "x-amz-copy-source": `/${this.bucket}/${from}`,
      "x-amz-metadata-directive": "REPLACE",
      "Content-Type": contentType,
    };
    if (options.ifMatch) headers["x-amz-copy-source-if-match"] = options.ifMatch;
    const response = await this.send(this.url(to), { method: "PUT", headers });
    if (!response.ok) this.fail(response, "copy");
    // CopyObject can answer 200 with an error document.
    if ((await response.text()).includes("<Error>")) throw new BlobStoreError("s3_copy_error");
  }

  private fail(response: Response, op: string): never {
    void response.body?.cancel();
    throw new BlobStoreError(`s3_${op}_${response.status}`);
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const response = await this.send(this.url(key), {
      method: "PUT",
      body: bytes as Uint8Array<ArrayBuffer>,
      // Sign the body hash (aws4fetch would send UNSIGNED-PAYLOAD) so the bucket checks it.
      headers: { "Content-Type": contentType, "X-Amz-Content-Sha256": await sha256Hex(bytes) },
    });
    if (!response.ok) this.fail(response, "put");
    void response.body?.cancel();
  }

  async head(key: string): Promise<BlobInfo | null> {
    const response = await this.send(this.url(key), { method: "HEAD" });
    if (response.status === 404) {
      void response.body?.cancel();
      return null;
    }
    if (!response.ok) this.fail(response, "head");
    return {
      size: Number(response.headers.get("content-length") ?? 0),
      lastModified: parseDate(response.headers.get("last-modified")),
      ...(response.headers.get("etag") ? { etag: response.headers.get("etag")! } : {}),
    };
  }

  /** `ifMatch`: the bucket answers 412 (thrown) when the object is no longer that version. */
  async get(
    key: string,
    spec?: RangeSpec,
    options: { ifMatch?: string } = {},
  ): Promise<BlobRead | BlobUnsatisfiable | null> {
    const headers: Record<string, string> = {};
    if (spec) headers.Range = rangeHeader(spec);
    if (options.ifMatch) headers["If-Match"] = options.ifMatch;
    const response = await this.send(this.url(key), { method: "GET", headers });
    if (response.status === 404) {
      void response.body?.cancel();
      return null;
    }
    if (response.status === 416) {
      void response.body?.cancel();
      const total = /^bytes \*\/(\d+)$/.exec(response.headers.get("content-range") ?? "");
      const size = total ? Number(total[1]) : (await this.head(key))?.size;
      return size === undefined ? null : { unsatisfiable: true, size };
    }
    if (!response.ok || !response.body) this.fail(response, "get");
    const lastModified = parseDate(response.headers.get("last-modified"));
    if (response.status === 206) {
      const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("content-range") ?? "");
      if (!match) this.fail(response, "range");
      return {
        size: Number(match[3]),
        lastModified,
        body: response.body,
        range: { start: Number(match[1]), end: Number(match[2]) },
      };
    }
    // 200: the whole file. If a range was asked for and the size is known, cut it here.
    const length = response.headers.get("content-length");
    const size = length ? Number(length) : null;
    if (spec && size !== null) {
      const range = resolveRange(spec, size);
      if (range === "unsatisfiable") {
        void response.body.cancel();
        return { unsatisfiable: true, size };
      }
      return { size, lastModified, body: slice(response.body, range), range };
    }
    return { size, lastModified, body: response.body };
  }

  async delete(key: string): Promise<boolean> {
    if (!(await this.head(key))) return false;
    const response = await this.send(this.url(key), { method: "DELETE" });
    if (!response.ok && response.status !== 404) this.fail(response, "delete");
    void response.body?.cancel();
    return true;
  }

  async list(prefix: string): Promise<BlobEntry[]> {
    assertPrefix(prefix);
    const entries: BlobEntry[] = [];
    let token: string | undefined;
    do {
      const params = new URLSearchParams({ "list-type": "2", prefix });
      if (token) params.set("continuation-token", token);
      const response = await this.send(`${this.base}?${params}`, { method: "GET" });
      if (!response.ok) this.fail(response, "list");
      const xml = await response.text();
      for (const [, block] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const key = decodeXml(xmlTag(block, "Key") ?? "");
        if (!KEY_RE.test(key)) continue;
        entries.push({
          key,
          size: Number(xmlTag(block, "Size") ?? 0),
          lastModified: parseDate(xmlTag(block, "LastModified") ?? null),
        });
      }
      token =
        xmlTag(xml, "IsTruncated") === "true"
          ? decodeXml(xmlTag(xml, "NextContinuationToken") ?? "") || undefined
          : undefined;
    } while (token);
    return entries;
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Buffer.from(digest).toString("hex");
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Keeps bytes [start, end] of a stream. */
function slice(body: ReadableStream<Uint8Array>, range: ByteRange): ReadableStream<Uint8Array> {
  let offset = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        const from = Math.max(range.start - offset, 0);
        const to = Math.min(range.end + 1 - offset, chunk.length);
        offset += chunk.length;
        if (to > from) controller.enqueue(chunk.subarray(from, to));
      },
    }),
  );
}

// --- s3 with local read fallback ------------------------------------------------------------

/**
 * Writes go to the bucket; reads try the bucket first and then the local folder, so files
 * from before the switch keep working until `npm run storage:push` copies them up.
 * Deletes remove both copies so a local leftover cannot come back.
 */
export class FallbackBlobStore implements BlobStore {
  readonly kind = "s3";
  constructor(
    readonly remote: BlobStore,
    readonly local: BlobStore,
  ) {}

  put(key: string, bytes: Uint8Array, contentType: string) {
    return this.remote.put(key, bytes, contentType);
  }
  head(key: string) {
    if (isPendingKey(key)) return this.remote.head(key);
    return this.read((store) => store.head(key));
  }
  get(key: string, range?: RangeSpec) {
    if (isPendingKey(key)) return this.remote.get(key, range);
    return this.read((store) => store.get(key, range));
  }

  /** Bucket first; the local copy when the bucket lacks the file or fails (logged, no details). */
  private async read<T>(op: (store: BlobStore) => Promise<T | null>): Promise<T | null> {
    let remote: T | null;
    try {
      remote = await op(this.remote);
    } catch (error) {
      const local = await op(this.local);
      if (local === null) throw error;
      console.error("[storage] bucket read failed, using local copy:", describeError(error));
      return local;
    }
    return remote ?? (await op(this.local));
  }
  async delete(key: string) {
    if (isPendingKey(key)) return this.remote.delete(key);
    const [remote, local] = await Promise.all([this.remote.delete(key), this.local.delete(key)]);
    return remote || local;
  }
  async list(prefix: string) {
    const [remote, local] = await Promise.all([this.remote.list(prefix), this.local.list(prefix)]);
    const seen = new Set(remote.map((e) => e.key));
    return [...remote, ...local.filter((e) => !seen.has(e.key))];
  }
}

// --- selection ------------------------------------------------------------------------------

export type StoreOptions = { root?: string; store?: BlobStore };

/** Store from the environment: s3 (with local fallback) when configured, else local files. */
export function blobStore(options: StoreOptions = {}, env: Env = process.env): BlobStore {
  if (options.store) return options.store;
  const local = new LocalBlobStore(options.root);
  const config = s3ConfigFromEnv(env);
  return config ? new FallbackBlobStore(new S3BlobStore(config), local) : local;
}

/** The bucket itself (no local fallback) when s3 is configured, else null. */
export function s3Store(env: Env = process.env): S3BlobStore | null {
  const config = s3ConfigFromEnv(env);
  return config ? new S3BlobStore(config) : null;
}

/** "s3" or "local" — the only storage detail ever shown or logged. */
export const blobStoreKind = (env: Env = process.env): "s3" | "local" =>
  s3ConfigFromEnv(env) ? "s3" : "local";
