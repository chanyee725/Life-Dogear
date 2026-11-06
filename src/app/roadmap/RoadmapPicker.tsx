import Link from "next/link";
import { cn } from "@/components/ui/cn";

export interface RoadmapPickerProps {
  roadmaps: { slug: string; title: string }[];
  /** Slug of the roadmap being shown. */
  current: string;
  className?: string;
}

/** Tab-style links to /roadmap?r=slug. Renders nothing when there is only one roadmap. */
export default function RoadmapPicker({ roadmaps, current, className }: RoadmapPickerProps) {
  if (roadmaps.length < 2) return null;

  return (
    <nav aria-label="로드맵 선택" className={cn("rp-root", className)}>
      {roadmaps.map((r) => {
        const selected = r.slug === current;
        return (
          <Link
            key={r.slug}
            href={`/roadmap?r=${encodeURIComponent(r.slug)}`}
            aria-current={selected ? "page" : undefined}
            className="rp-tab"
          >
            {r.title}
          </Link>
        );
      })}
    </nav>
  );
}
