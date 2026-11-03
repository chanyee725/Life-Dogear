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
import { gcImages, referencedImages } from "../src/lib/storage/maintenance";

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

async function main() {
  loadEnvIfPresent();
  const apply = process.argv.includes("--apply");
  // A bucket shared through Turso must not be judged against one PC's local DB.
  if (apply && blobStoreKind() === "s3" && resolveDbConfig().url.startsWith("file:")) {
    console.error("공유 저장소(S3)를 쓰는데 DB가 로컬 파일입니다. Turso 설정 후 다시 실행하세요.");
    process.exit(1);
  }
  const referenced = referencedImages(await allTextValues());
  const store = blobStore();
  if (apply && referenced.size === 0 && (await store.list("images/")).length > 0) {
    console.error(
      "본문에서 참조하는 사진이 하나도 없습니다. DB 설정을 확인하세요 (삭제하지 않음).",
    );
    process.exit(1);
  }
  const result = await gcImages(store, referenced, { apply });
  console.log(
    [
      `저장소: ${blobStoreKind()}`,
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
