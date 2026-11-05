import type { Metadata } from "next";
import localFont from "next/font/local";
import { QuickCapture } from "@/components/capture/QuickCapture";
import { CommandPalette } from "@/components/search/CommandPalette";
import { SearchButton } from "@/components/search/SearchButton";
import { Shortcuts } from "@/components/shell/Shortcuts";
import { Sidebar } from "@/components/shell/Sidebar";
import { themeInitScript } from "@/components/shell/theme";
import { AppToaster } from "@/components/ui/Toast";
import { canShowApp } from "@/lib/auth/server";
import "./globals.css";

// Self-hosted from node_modules: no requests to external font CDNs.
const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  weight: "45 920",
  display: "swap",
  variable: "--font-pretendard",
});

export const metadata: Metadata = {
  title: { default: "Life Dogear", template: "%s · Life Dogear" },
  description: "개인 연구 노트",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Signed out (or setup needed): no sidebar, search or capture, which read the notes.
  const showApp = await canShowApp();
  return (
    <html lang="ko" className={pretendard.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh">
        {showApp ? <Sidebar searchSlot={<SearchButton />} /> : null}
        <main className="min-w-0 flex-1">{children}</main>
        {showApp ? (
          <>
            <Shortcuts />
            <CommandPalette />
            <QuickCapture />
          </>
        ) : null}
        <AppToaster />
      </body>
    </html>
  );
}
