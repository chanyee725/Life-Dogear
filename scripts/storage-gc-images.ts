/**
 * Finds photos no body refers to and, with --apply, deletes the ones created more than
 * 24 hours ago (newer ones may sit in an unsaved draft). Default is a dry run.
 * Every text column of every table is searched, so any mention keeps the photo.
 * Uses the same storage as the app (bucket + local folder when S3_* is set). Counts only.
 *
 *   npm run storage:gc-images            # dry run: count
 *   npm run storage:gc-images -- --apply # delete
 */
import { describeError } from "../src/lib/storage/describe-error";
import { createClient } from "@libsql/client";
import { ensureLocalDir, resolveDbConfig } from "../src/db/config";
import { loadEnvIfPresent } from "../src/db/env";
import { blobStore, blobStoreKind } from "../src/lib/storage/blob";
import { gcGuard, gcImages, referencedImages, type GcBlock } from "../src/lib/storage/maintenance";

async function allTextValues(): Promise<string[]> {
  const config = resolveDbConfig();
  ensureLocalDir(config.url);
  const client = createClient(config);
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  const values: string[] = [];
  for (const row of tables.rows) {
    const table = String(row.name).replace(/"/g, '""');
    const result = await client.execute(`SELECT * FROM "${table}"`);
    for (const r of result.rows) {
      for (const value of Object.values(r)) if (typeof value === "string") values.push(value);
    }
  }
  client.close();
  return values;
}

const BLOCKED: Record<GcBlock, string> = {
  shared_store_local_db:
    "공유 저장소(S3)를 쓰는데 DB가 로컬 파일입니다. Turso 설정 후 다시 실행하세요.",
  no_references: "본문에서 참조하는 사진이 하나도 없습니다. DB 설정을 확인하세요 (삭제하지 않음).",
};

async function main() {
  loadEnvIfPresent();
  const apply = process.argv.includes("--apply");
  const storeKind = blobStoreKind();
  const dbKind = resolveDbConfig().url.startsWith("file:") ? "local" : "turso";
  // Kinds only: never the endpoint, bucket or database address.
  console.log(`저장소: ${storeKind} · DB: ${dbKind}${apply ? "" : " · dry-run"}`);
  const store = blobStore();
  if (apply && storeKind === "s3" && dbKind === "local") {
    console.error(BLOCKED.shared_store_local_db);
    process.exit(1);
  }
  const referenced = referencedImages(await allTextValues());
  if (apply) {
    const total = (await store.list("images/")).length;
    const block = gcGuard({ storeKind, dbKind, referenced: referenced.size, total });
    if (block) {
      console.error(BLOCKED[block]);
      process.exit(1);
    }
  }
  const result = await gcImages(store, referenced, { apply });
  console.log(
    [
      `사진 ${result.total}개 · 사용 중 ${result.referenced}개 · 24시간 안 된 미사용 ${result.tooNew}개`,
      apply
        ? `안 쓰는 사진 ${result.unreferenced}개 중 ${result.deleted}개 삭제 · 실패 ${result.failed}개`
        : `[dry-run] 지울 사진 ${result.unreferenced}개 (지우려면 -- --apply)`,
    ].join("\n"),
  );
  if (result.failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error("storage:gc-images 실패:", describeError(error));
  process.exit(1);
});
