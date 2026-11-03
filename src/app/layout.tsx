import type { Metadata } from "next";
import localFont from "next/font/local";
import { QuickCapture } from "@/components/capture/QuickCapture";
import { CommandPalette } from "@/components/search/CommandPalette";
import { SearchButton } from "@/components/search/SearchButton";
import { Shortcuts } from "@/components/shell/Shortcuts";
import { Sidebar } from "@/components/shell/Sidebar";
import { themeInitScript } from "@/components/shell/theme";
import "./globals.css";

// Self-hosted from node_modules: no requests to external font CDNs.
const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  weight: "45 920",
  display: "swap",
  variable: "--font-pretendard",
});

const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: { default: "Research Brain", template: "%s · Research Brain" },
  description: "개인 연구 노트",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh">
        <Sidebar searchSlot={<SearchButton />} />
        <main className="min-w-0 flex-1">{children}</main>
        <Shortcuts />
        <CommandPalette />
        <QuickCapture />
      </body>
    </html>
  );
}
