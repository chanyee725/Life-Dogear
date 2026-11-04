import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import type { SetupReason } from "@/lib/auth/mode";
import { currentAuthMode } from "@/lib/auth/server";

export const metadata: Metadata = { title: "설정 필요" };

const REASON_TEXT: Record<SetupReason, string> = {
  "auth-required": "인터넷에서 열리는 곳에서는 로그인 설정 없이 열지 않습니다.",
  "auth-incomplete": "로그인 설정이 일부만 채워져 있습니다.",
  "storage-required": "Vercel에서는 사진과 PDF를 R2에 저장해야 합니다.",
};

/** The app stays closed until these settings are filled in. Lists names only, never values. */
export default async function SetupPage() {
  const mode = await currentAuthMode();
  if (mode.kind !== "setup") redirect("/");

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-base font-semibold text-fg">설정이 필요합니다</h1>
        {mode.reasons.map((reason) => (
          <p key={reason} className="text-[13px] text-muted">
            {REASON_TEXT[reason]}
          </p>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-medium text-fg">확인할 환경변수</p>
        <ul className="flex flex-wrap gap-1.5">
          {mode.missing.map((name) => (
            <li key={name}>
              <code className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-fg">
                {name}
              </code>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[13px] text-muted">
        docs/DEPLOY.md를 따라 값을 넣은 뒤 다시 배포하거나 서버를 다시 시작하세요.
      </p>
    </Card>
  );
}
