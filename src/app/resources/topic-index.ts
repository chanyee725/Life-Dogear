/**
 * Pure helpers for the `/resources` topic index: sort order, initial-sound (초성) groups,
 * density-bar ratios and the text filter. No server imports, so the client index can use
 * them; `resource-data.ts` re-exports them for the page and tests.
 */

export type TopicCount = { name: string; count: number };

/** Index order: most items first (default) or by name, grouped by initial. */
export type TopicSort = "count" | "name";

export function parseSortParam(value: unknown): TopicSort {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "name" ? "name" : "count";
}

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
/** Leading consonants of composed syllables, in Unicode order (19). */
const CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
/** Index headings: double consonants fold into their base (ㄲ → ㄱ). */
const GROUP_CONSONANTS = "ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ";
const FOLD: Record<string, string> = { ㄲ: "ㄱ", ㄸ: "ㄷ", ㅃ: "ㅂ", ㅆ: "ㅅ", ㅉ: "ㅈ" };

/** Leading consonant of one character (composed syllable or bare jamo); null otherwise. */
function choseongOf(ch: string): string | null {
  const code = ch.codePointAt(0) ?? 0;
  if (code >= HANGUL_BASE && code <= HANGUL_LAST)
    return CHOSEONG[Math.floor((code - HANGUL_BASE) / 588)] ?? null;
  return CHOSEONG.includes(ch) ? ch : null;
}

/** Group heading for a name: ㄱ…ㅎ (doubles folded), A–Z, else "#". */
export function initialOf(name: string): string {
  const first = [...name.normalize("NFC").trim()][0] ?? "";
  const cho = choseongOf(first);
  if (cho) return FOLD[cho] ?? cho;
  const upper = first.toUpperCase();
  return upper >= "A" && upper <= "Z" && upper.length === 1 ? upper : "#";
}

/** Initial sounds of every syllable, e.g. "통계 검정" → "ㅌㄱ ㄱㅈ"; other characters kept. */
export function initialsOf(name: string): string {
  return [...name.normalize("NFC")].map((ch) => choseongOf(ch) ?? ch.toLowerCase()).join("");
}

/** Hangul ㄱ…ㅎ first, then A–Z, then "#". */
function groupRank(key: string): number {
  const h = GROUP_CONSONANTS.indexOf(key);
  if (h >= 0) return h;
  if (key >= "A" && key <= "Z") return 100 + key.charCodeAt(0);
  return 1000;
}

const byName = (a: TopicCount, b: TopicCount) =>
  a.name.localeCompare(b.name, "ko", { sensitivity: "base" }) || a.name.localeCompare(b.name);

/** Name order: ㄱ…ㅎ groups, then A–Z, then the rest; within a group by name. */
const byIndexName = (a: TopicCount, b: TopicCount) =>
  groupRank(initialOf(a.name)) - groupRank(initialOf(b.name)) || byName(a, b);

/** `count`: most items first, ties in name order. `name`: name order (see `byIndexName`). */
export function sortTopics<T extends TopicCount>(topics: readonly T[], sort: TopicSort): T[] {
  const list = [...topics];
  if (sort === "count") return list.sort((a, b) => b.count - a.count || byIndexName(a, b));
  return list.sort(byIndexName);
}

export type TopicGroup<T> = { key: string; topics: T[] };

/** Consecutive runs of the name-sorted list under their initial (ㄱ, ㄴ, …, A, B, …, #). */
export function groupTopicsByInitial<T extends TopicCount>(topics: readonly T[]): TopicGroup<T>[] {
  const groups: TopicGroup<T>[] = [];
  for (const topic of sortTopics(topics, "name")) {
    const key = initialOf(topic.name);
    const last = groups.at(-1);
    if (last?.key === key) last.topics.push(topic);
    else groups.push({ key, topics: [topic] });
  }
  return groups;
}

/** Bar length as a share of the largest count, in [0, 1]. */
export function densityRatio(count: number, max: number): number {
  if (!(max > 0) || !(count > 0)) return 0;
  return Math.min(1, count / max);
}

/** Text-filter key: lower-cased name plus its initial sounds. */
export function topicSearchKey(name: string): { name: string; initials: string } {
  const nfc = name.normalize("NFC");
  return { name: nfc.toLowerCase(), initials: initialsOf(nfc) };
}

const ONLY_JAMO = new RegExp(`^[${CHOSEONG}\\s]+$`);

/**
 * Whether a topic matches the filter text: substring of the name (case-insensitive),
 * or — when the text is only bare consonants like "ㅌㄱ" — of its initial sounds.
 */
export function matchesTopic(key: { name: string; initials: string }, query: string): boolean {
  const q = query.normalize("NFC").trim().toLowerCase();
  if (!q) return true;
  if (key.name.includes(q)) return true;
  return ONLY_JAMO.test(q) && key.initials.includes(q);
}
