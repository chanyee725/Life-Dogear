import type { Metadata } from "next";
import { connection } from "next/server";
import { Page, PageHeader } from "@/components/shell/PageHeader";
import { currentAuthMode } from "@/lib/auth/server";
import { settingsView } from "@/lib/settings";
import { SettingsPanel } from "./_components/SettingsPanel";

export const metadata: Metadata = { title: "설정" };
export const dynamic = "force-dynamic";

/** One place for app settings. Values are masked on the server; secrets never reach the page. */
export default async function SettingsPage() {
  await connection();
  const view = await settingsView((await currentAuthMode()).kind);
  return (
    <Page className="max-w-3xl">
      <PageHeader title="설정" />
      <SettingsPanel initial={view} />
    </Page>
  );
}
