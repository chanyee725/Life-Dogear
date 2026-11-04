import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, buttonClass } from "@/components/ui";
import { currentAuthMode } from "@/lib/auth/server";

export const metadata: Metadata = { title: "사용할 수 없는 계정" };

/** Shown when a Google account outside ALLOWED_EMAILS tries to sign in (no session is made). */
export default async function DeniedPage() {
  const mode = await currentAuthMode();
  if (mode.kind === "setup") redirect("/setup");
  if (mode.kind === "local") redirect("/");

  return (
    <EmptyState
      title="이 계정은 사용할 수 없습니다"
      description="허용된 Google 계정으로 다시 로그인하세요."
      action={
        <Link href="/login" className={buttonClass("secondary", "sm")}>
          다른 계정으로 로그인
        </Link>
      }
    />
  );
}
