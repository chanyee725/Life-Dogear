import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Research Brain",
  description: "개인 연구 노트",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
