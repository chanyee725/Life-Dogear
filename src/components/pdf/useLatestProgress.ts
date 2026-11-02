import { useEffect, useState } from "react";
import { fetchProgress } from "./progress-client";
import { isLaterReadAt, type RemoteProgress } from "./remote-progress";

/**
 * Server-rendered reading progress kept current: re-checks the progress endpoint
 * on mount and when the page is restored from history, and takes the server value
 * when it was read later (e.g. after reading and pressing back).
 */
export function useLatestProgress(url: string | null, initial: RemoteProgress): RemoteProgress {
  const [progress, setProgress] = useState(initial);
  const [rendered, setRendered] = useState(initial);
  // New server-rendered values (refresh, PDF replaced) replace whatever we fetched.
  if (
    rendered.page !== initial.page ||
    rendered.totalPages !== initial.totalPages ||
    rendered.lastReadAt !== initial.lastReadAt
  ) {
    setRendered(initial);
    setProgress(initial);
  }

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const check = async () => {
      const remote = await fetchProgress(url);
      if (!remote || cancelled) return;
      setProgress((current) =>
        isLaterReadAt(remote.lastReadAt, current.lastReadAt) ? remote : current,
      );
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void check();
    };
    const onPopState = () => void check();
    void check();
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPopState);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPopState);
    };
  }, [url]);

  return progress;
}
