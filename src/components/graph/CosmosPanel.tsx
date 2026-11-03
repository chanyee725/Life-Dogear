"use client";

/**
 * "우주 요약" side panel for the cosmos view (docs/design/cosmos.md 7.3): 중요한 별 Top 10,
 * 외톨이 별, 오래 손대지 않은 중요한 별. Rows select the node; hovering a row highlights
 * it on the canvas. Collapsible (localStorage `rb-cosmos-panel`).
 */
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import type { CosmosResponse } from "@/lib/cosmos/types";
import type { GraphNode, GraphNodeId } from "@/lib/graph/types";
import { galaxyColor } from "./cosmos-model";
import { COSMOS_THEME, GRAPH_THEME_DARK, type GraphTheme } from "./graph-theme";
import { GRAPH_TYPE_LABEL } from "./model";
import { ShapeIcon } from "./ShapeIcon";

export const COSMOS_PANEL_STORAGE_KEY = "rb-cosmos-panel";
const LONELY_SHOWN = 8;
const DAY_MS = 86_400_000;

/** ShapeIcon colors for a node in the cosmos palette (goal gold, the rest its galaxy color). */
export function cosmosIconTheme(color: string): GraphTheme {
  return {
    ...GRAPH_THEME_DARK,
    accent: COSMOS_THEME.gold,
    accentSoft: COSMOS_THEME.space,
    gray1: color,
    gray2: color,
    gray3: color,
    gray4: color,
    gray5: COSMOS_THEME.neutral,
  };
}

export function daysAgoLabel(iso: string | null, now = Date.now()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return `${Math.max(0, Math.floor((now - t) / DAY_MS))}일 전`;
}

function Section({
  title,
  count,
  children,
  help,
}: {
  title: string;
  count: number;
  children: ReactNode;
  help?: string;
}) {
  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted">{title}</h3>
        <span className="text-xs text-muted tabular-nums">{count}</span>
      </div>
      {children}
      {help ? <p className="text-xs text-muted">{help}</p> : null}
    </section>
  );
}

export function CosmosPanel({
  data,
  byId,
  narrow,
  onSelect,
  onHover,
  onShowAllLonely,
}: {
  data: CosmosResponse;
  byId: ReadonlyMap<GraphNodeId, GraphNode>;
  narrow: boolean;
  onSelect: (id: GraphNodeId) => void;
  onHover: (id: GraphNodeId | null) => void;
  /** "+ n개 더": turn on "연결 없는 항목만" and go back to the basic view. */
  onShowAllLonely: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem(COSMOS_PANEL_STORAGE_KEY);
    setCollapsed(saved === null ? narrow : saved === "collapsed");
  }, [narrow]);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COSMOS_PANEL_STORAGE_KEY, next ? "collapsed" : "expanded");
  }

  const order = new Map(data.galaxies.map((g, i) => [g.id, i] as const));
  const row = (id: GraphNodeId, left: ReactNode, right: ReactNode) => {
    const node = byId.get(id);
    if (!node) return null;
    const color = galaxyColor(data.cosmos[id]?.galaxy ?? null, order);
    return (
      <li key={id}>
        <button
          type="button"
          onClick={() => onSelect(id)}
          onMouseEnter={() => onHover(id)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(id)}
          onBlur={() => onHover(null)}
          className="-mx-2 flex h-8 w-[calc(100%+16px)] items-center gap-2 rounded-md px-2 text-left text-[13px] hover:bg-hover"
        >
          {left}
          <ShapeIcon
            type={node.type}
            horizon={node.horizon}
            theme={cosmosIconTheme(color)}
            className="shrink-0"
          />
          <span className="min-w-0 flex-1 truncate text-fg">{node.title}</span>
          <span className="shrink-0 text-xs text-muted tabular-nums">{right}</span>
        </button>
      </li>
    );
  };
  const empty = (text: string) => (
    <p className="flex h-8 items-center text-[13px] text-muted">{text}</p>
  );

  const lonelyShown = data.lonely.slice(0, LONELY_SHOWN);
  const lonelyMore = data.lonely.length - lonelyShown.length;

  return (
    <aside
      role="complementary"
      aria-label="우주 요약"
      className={
        collapsed
          ? "absolute top-4 left-4 z-20 flex h-11 items-center gap-2 rounded-lg border border-border bg-bg px-4"
          : "absolute top-4 left-4 z-20 flex max-h-[calc(100%-72px)] w-72 flex-col gap-5 overflow-y-auto rounded-lg border border-border bg-bg p-4"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">우주 요약</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "우주 요약 펼치기" : "우주 요약 접기"}
          onClick={toggle}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={collapsed ? "-rotate-90" : ""}
          >
            <path d="M3 4.5 6 7.5l3-3" />
          </svg>
        </Button>
      </div>
      {collapsed ? null : (
        <>
          <Section title="중요한 별 Top 10" count={data.top.length}>
            {data.top.length ? (
              <ul className="flex flex-col">
                {data.top.map((id, i) =>
                  row(
                    id,
                    <span className="w-4 shrink-0 text-xs text-muted tabular-nums">{i + 1}</span>,
                    (data.cosmos[id]?.score ?? 0).toFixed(2),
                  ),
                )}
              </ul>
            ) : (
              empty("아직 점수를 매길 항목이 없습니다.")
            )}
          </Section>

          <Section
            title="외톨이 별"
            count={data.lonely.length}
            help={data.lonely.length ? "다른 항목과 이어 주면 은하 안으로 들어갑니다." : undefined}
          >
            {lonelyShown.length ? (
              <ul className="flex flex-col">
                {lonelyShown.map((id) => {
                  const node = byId.get(id);
                  return row(id, null, node ? GRAPH_TYPE_LABEL[node.type] : "");
                })}
              </ul>
            ) : (
              empty("외톨이 별이 없습니다. 모두 어딘가에 이어져 있어요.")
            )}
            {lonelyMore > 0 ? (
              <button
                type="button"
                onClick={onShowAllLonely}
                className="self-start text-xs text-muted hover:text-fg"
              >
                + {lonelyMore}개 더
              </button>
            ) : null}
          </Section>

          <Section
            title="오래 손대지 않은 중요한 별"
            count={data.neglected.length}
            help={data.neglected.length ? "오래된 순. 열어서 다시 살펴보세요." : undefined}
          >
            {data.neglected.length ? (
              <ul className="flex flex-col">
                {data.neglected.map((id) =>
                  row(id, null, daysAgoLabel(data.cosmos[id]?.lastActiveAt ?? null)),
                )}
              </ul>
            ) : (
              empty("중요한 항목을 모두 최근에 살펴봤습니다.")
            )}
          </Section>
        </>
      )}
    </aside>
  );
}
