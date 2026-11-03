/**
 * Grouping for list pages (`?group=`): items keep their sorted order inside each group,
 * groups follow the given order, and empty groups are dropped.
 */
export type ItemGroup<T> = { key: string; label: string; items: T[] };

export type GroupOption = { value: string; label: string };

/** Groups by a known set of keys (e.g. read status); unknown keys go to a trailing "기타". */
export function groupByKey<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  order: readonly GroupOption[],
): ItemGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  const known = new Set(order.map((o) => o.value));
  const groups: ItemGroup<T>[] = order
    .filter((o) => buckets.has(o.value))
    .map((o) => ({ key: o.value, label: o.label, items: buckets.get(o.value)! }));
  const rest = [...buckets].filter(([key]) => !known.has(key)).flatMap(([, list]) => list);
  if (rest.length) groups.push({ key: "other", label: "기타", items: rest });
  return groups;
}

/** Groups by year, newest first; items without a year go last. */
export function groupByYear<T>(
  items: readonly T[],
  yearOf: (item: T) => number | null,
): ItemGroup<T>[] {
  const years = [...new Set(items.map(yearOf).filter((y): y is number => y !== null))].sort(
    (a, b) => b - a,
  );
  return groupByKey(items, (item) => String(yearOf(item) ?? "none"), [
    ...years.map((y) => ({ value: String(y), label: `${y}년` })),
    { value: "none", label: "연도 없음" },
  ]);
}

/**
 * Groups dated items into 다가오는 (after `today`), then month by month, newest first, then
 * 날짜 없음. `today` is a local `YYYY-MM-DD`; dates are `YYYY-MM-DD` strings.
 */
export function groupByMonth<T>(
  items: readonly T[],
  dateOf: (item: T) => string | null,
  today: string,
): ItemGroup<T>[] {
  const keyOf = (item: T): string => {
    const date = dateOf(item);
    if (!date || !/^\d{4}-\d{2}/.test(date)) return "none";
    return date > today ? "upcoming" : date.slice(0, 7);
  };
  const months = [...new Set(items.map(keyOf))]
    .filter((k) => k !== "none" && k !== "upcoming")
    .sort((a, b) => b.localeCompare(a));
  return groupByKey(items, keyOf, [
    { value: "upcoming", label: "다가오는 일정" },
    ...months.map((m) => ({ value: m, label: `${m.slice(0, 4)}년 ${Number(m.slice(5, 7))}월` })),
    { value: "none", label: "날짜 없음" },
  ]);
}

/** `?group=` value if it is one of `options`, else `fallback`. */
export function parseGroup<V extends string>(
  raw: string | undefined,
  options: readonly { value: V }[],
  fallback: V,
): V {
  return options.find((o) => o.value === raw)?.value ?? fallback;
}
