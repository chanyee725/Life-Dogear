import Link from "next/link";

/** One line under the quick input: how many captured thoughts wait in the inbox. */
export function InboxLine({ count }: { count: number }) {
  if (count === 0) {
    return <p className="text-[13px] text-faint">수집함이 비어 있습니다.</p>;
  }
  return (
    <p className="text-[13px] text-muted">
      <Link href="/inbox" className="hover:text-fg">
        수집함에 정리할 항목 <span className="font-medium text-fg tabular-nums">{count}</span>개 →
      </Link>
    </p>
  );
}
