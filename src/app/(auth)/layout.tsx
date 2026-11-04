import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Sign-in, refusal and setup pages: one narrow centred column, no app shell. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <p className="text-center text-sm font-semibold text-fg">Research Brain</p>
        {children}
      </div>
    </div>
  );
}
