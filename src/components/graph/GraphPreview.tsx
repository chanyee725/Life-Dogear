"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { ITEM_TYPE } from "@/lib/enums";
import type { GraphNode, GraphNodeId } from "@/lib/graph/types";
import { fetchPreview } from "./api";
import type { GraphTheme } from "./graph-theme";
import { goalLabel, GRAPH_TYPE_LABEL, nodeHref } from "./model";
import type { NodePreview } from "./preview-types";
import { ShapeIcon } from "./ShapeIcon";

const MAX_NEIGHBORS = 6;

function badgeOf(node: GraphNode): { text: string; tone: string } {
  if (node.type === "tag") return { text: "주제", tone: "gray" };
  const text = node.type === "goal" ? goalLabel(node) : GRAPH_TYPE_LABEL[node.type];
  return { text, tone: ITEM_TYPE.is(node.type) ? ITEM_TYPE.tone(node.type) : "gray" };
}

/** Right-hand preview of the selected node (design 6.4). Not a dialog: focus is not trapped. */
export function GraphPreview({
  node,
  neighbors,
  theme,
  mock,
  onClose,
  onSelect,
}: {
  node: GraphNode;
  neighbors: readonly GraphNode[];
  theme: GraphTheme;
  mock: boolean;
  onClose: () => void;
  onSelect: (id: GraphNodeId) => void;
}) {
  const [detail, setDetail] = useState<{ id: string; data: NodePreview | null } | null>(null);

  useEffect(() => {
    if (mock || node.type === "tag") return;
    const controller = new AbortController();
    fetchPreview(node.id, controller.signal)
      .then((data) => setDetail({ id: node.id, data }))
      .catch(() => {
        if (!controller.signal.aborted) setDetail({ id: node.id, data: null });
      });
    return () => controller.abort();
  }, [node.id, node.type, mock]);

  const data = detail?.id === node.id ? detail.data : null;
  const badge = badgeOf(node);
  const href = nodeHref(node);
  const archived = node.archived || data?.archived;
  const shown = neighbors.slice(0, MAX_NEIGHBORS);

  return (
    <section
      role="region"
      aria-label={`미리보기: ${node.title}`}
      className="absolute top-4 right-4 z-20 flex max-h-[calc(100%-32px)] w-80 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-bg p-5 shadow-overlay"
    >
      <div className="flex items-center gap-1.5">
        <Badge tone={badge.tone}>{data?.badge ?? badge.text}</Badge>
        {archived ? <Badge tone="gray">보관</Badge> : null}
        <Button
          variant="ghost"
          size="icon"
          aria-label="미리보기 닫기"
          onClick={onClose}
          className="ml-auto h-7 w-7"
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
          >
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
          </svg>
        </Button>
      </div>

      <h2 className="line-clamp-3 text-lg font-semibold tracking-tight break-words text-fg">
        {node.title}
      </h2>

      {data && data.props.length > 0 ? (
        <dl className="flex flex-col gap-1 text-[13px]">
          {data.props.map((p) => (
            <div key={p.label} className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted">{p.label}</dt>
              <dd className="min-w-0 text-fg break-words">{p.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {data?.summary ? <p className="line-clamp-4 text-[13px] text-muted">{data.summary}</p> : null}

      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-muted">연결 {neighbors.length}</h3>
        {shown.length > 0 ? (
          <ul className="flex flex-col">
            {shown.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onSelect(n.id)}
                  className="flex h-8 w-full items-center gap-2 rounded-md px-1.5 text-left text-[13px] text-fg hover:bg-hover"
                >
                  <ShapeIcon type={n.type} horizon={n.horizon} theme={theme} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{n.title}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {neighbors.length > MAX_NEIGHBORS ? (
          <p className="px-1.5 text-xs text-muted">+ {neighbors.length - MAX_NEIGHBORS}개 더</p>
        ) : null}
      </div>

      {href ? (
        <div>
          <Link href={href} className={buttonClass("primary", "sm")}>
            열기
          </Link>
        </div>
      ) : null}
    </section>
  );
}
