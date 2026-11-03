/**
 * Copies photos and PDFs saved in DATA_DIR to the shared bucket (S3_* settings), once.
 * Keys already in the bucket are skipped. Prints counts only.
 *
 *   npm run storage:push              # upload
 *   npm run storage:push -- --dry-run # only count what would be uploaded
 */
import { describeError } from "./describe-error";
import { loadEnvIfPresent } from "../src/db/env";
import { LocalBlobStore, S3BlobStore, s3ConfigFromEnv } from "../src/lib/storage/blob";
import { pushLocalFiles } from "../src/lib/storage/maintenance";

async function main() {
  loadEnvIfPresent();
  const dryRun = process.argv.includes("--dry-run");
  const config = s3ConfigFromEnv();
  if (!config) {
    console.error(
      "공유 저장소가 설정되지 않았습니다. .env에 S3_ENDPOINT·S3_BUCKET·S3_ACCESS_KEY_ID·S3_SECRET_ACCESS_KEY를 모두 넣으세요.",
    );
    process.exit(1);
  }
  const result = await pushLocalFiles(new LocalBlobStore(), new S3BlobStore(config), { dryRun });
  console.log(
    `${dryRun ? "[dry-run] 올릴 파일" : "올린 파일"} ${result.uploaded}개 · 이미 있음 ${result.skipped}개 · 실패 ${result.failed}개`,
  );
  if (result.failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error("storage:push 실패:", describeError(error));
  process.exit(1);
});
