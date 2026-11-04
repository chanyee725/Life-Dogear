/**
 * Backs up the local DB (VACUUM INTO) and DATA_DIR photos and PDFs now, into
 * BACKUP_DIR (default `<DATA_DIR>/backups`), keeping the newest 14. Safe while the server
 * runs. Prints the folder name and counts only.
 *
 *   npm run backup
 */
import { loadEnvIfPresent } from "../src/db/env";
import { KEEP_BACKUPS, runBackup } from "../src/lib/backup";

async function main() {
  loadEnvIfPresent();
  const result = await runBackup();
  if (result.status === "done") {
    const db = { copied: "DB 포함", turso: "DB 제외(Turso)", missing: "DB 없음" }[result.db];
    console.log(
      `백업 완료: ${result.name} · ${db} · 파일 ${result.files}개 · 오래된 백업 ${result.pruned}개 정리 (최근 ${KEEP_BACKUPS}개 유지)`,
    );
    return;
  }
  if (result.status === "skipped") {
    const why = {
      vercel: "Vercel에서는 백업하지 않습니다.",
      busy: "다른 백업이 진행 중입니다. 잠시 뒤 다시 실행하세요.",
      recent: "방금 만든 백업이 있습니다. 1분 뒤 다시 실행하세요.",
    }[result.reason];
    console.log(`백업 건너뜀: ${why}`);
    return;
  }
  process.exit(1);
}

main().catch(() => {
  console.error("백업 실패(script)");
  process.exit(1);
});
