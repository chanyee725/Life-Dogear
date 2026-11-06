/** Shown on /roadmap when no learning roadmap exists yet. */
export default function RoadmapEmpty() {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-16 text-center text-sm text-[var(--rb-muted)]">
      <p className="font-medium text-[var(--rb-fg)]">아직 학습 로드맵이 없어요</p>
      <p>Claude Code에게 &quot;○○ 로드맵 만들어줘&quot;라고 하면 여기 생겨요.</p>
    </div>
  );
}
