import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { safeNextPath } from "@/lib/auth/access";
import { currentAuthMode, hasAllowedSession } from "@/lib/auth/server";
import { GoogleSignInButton } from "./GoogleSignInButton";

export const metadata: Metadata = { title: "로그인" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(first(params.next));
  const mode = await currentAuthMode();
  if (mode.kind === "setup") redirect("/setup");
  if (mode.kind === "local") redirect("/");
  if (await hasAllowedSession()) redirect(next);

  // Auth.js puts an error code here when sign-in fails; show a plain message, not the code.
  const failed = Boolean(first(params.error));

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-base font-semibold text-fg">로그인</h1>
        <p className="text-[13px] text-muted">허용된 Google 계정으로 로그인하세요.</p>
      </div>
      {failed ? (
        <p role="alert" className="text-[13px] text-danger">
          로그인하지 못했습니다. 다시 시도해 주세요.
        </p>
      ) : null}
      <GoogleSignInButton redirectTo={next} />
    </Card>
  );
}
