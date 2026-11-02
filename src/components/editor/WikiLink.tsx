"use client";

import { InputRule, Node, type Editor } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createThoughtForTitle } from "@/app/_actions/wikilinks";
import { safeAction } from "@/components/links/safe-action";
import { cn } from "@/components/ui/cn";
import { ITEM_TYPE } from "@/lib/enums";
import { cleanTitle } from "@/lib/wikilinks";
import { invalidateWikiTitles, itemFromPath, itemHref, useWikiTarget } from "./wiki-resolver";
import { wikiLinkPlugin, type MarkdownItLike } from "./wikilink-markdown";

/** True inside a quote or code, where `[[…]]` stays plain text (see `@/lib/wikilinks`). */
export function inPlainTextZone($pos: ResolvedPos): boolean {
  if ($pos.parent.type.spec.code) return true;
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === "blockquote") return true;
  }
  return $pos.marks().some((m) => m.type.name === "code");
}

type MarkdownState = { write: (text: string) => void };

/**
 * `[[title]]` as an inline atom. Stored in Markdown as `[[title]]`; shown as the title,
 * linked when an item has it, gray (with "생각으로 만들기") when none does.
 */
export const WikiLink = Node.create({
  name: "wikiLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      title: {
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-wikilink") ?? "",
        renderHTML: (attrs: { title: string }) => ({ "data-wikilink": attrs.title }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-wikilink]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["span", { ...HTMLAttributes, class: "rb-wikilink" }, `[[${node.attrs.title}]]`];
  },

  renderText({ node }) {
    return `[[${node.attrs.title}]]`;
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownState, node: { attrs: { title: string } }) {
          state.write(`[[${node.attrs.title}]]`);
        },
        parse: {
          setup(md: MarkdownItLike) {
            wikiLinkPlugin(md);
          },
        },
      },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        // Typing the closing `]]` of `[[title]]`.
        find: /\[\[([^[\]\n]+)\]\]$/,
        handler: ({ state, range, match }) => {
          const title = cleanTitle(match[1] ?? "");
          if (!title || inPlainTextZone(state.doc.resolve(range.from))) return null;
          state.tr.replaceWith(range.from, range.to, this.type.create({ title }));
        },
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkView, { as: "span" });
  },
});

/** Inserts `[[title]]` over `from..to` (the typed `[[query`). */
export function insertWikiLink(editor: Editor, from: number, to: number, title: string) {
  editor
    .chain()
    .focus()
    .insertContentAt({ from, to }, [
      { type: "wikiLink", attrs: { title } },
      { type: "text", text: " " },
    ])
    .run();
}

function WikiLinkView({ node, selected }: ReactNodeViewProps) {
  const title = String(node.attrs.title ?? "");
  const target = useWikiTarget(title);
  const router = useRouter();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = () => {
    if (target) router.push(itemHref(target.ref));
    else if (target === null) setMenu((m) => !m);
  };

  const create = () =>
    startTransition(async () => {
      const result = await safeAction(() =>
        createThoughtForTitle(title, itemFromPath(pathname) ?? undefined),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMenu(false);
      invalidateWikiTitles();
      router.refresh();
    });

  return (
    <NodeViewWrapper as="span" className="relative">
      <span
        role="link"
        tabIndex={-1}
        data-wikilink={title}
        data-state={target ? "resolved" : target === null ? "missing" : "loading"}
        title={
          target
            ? `${ITEM_TYPE.label(target.type)} 열기${target.archived ? " (보관됨)" : ""}`
            : target === null
              ? "없는 제목 — 눌러서 생각으로 만들기"
              : undefined
        }
        // Keep the editor from turning the click into a node selection drag.
        onMouseDown={(e) => e.preventDefault()}
        onClick={open}
        className={cn(
          "rb-wikilink cursor-pointer rounded px-0.5",
          target
            ? "text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
            : "text-faint",
          target?.archived && "opacity-70",
          selected && "ring-2 ring-ring",
        )}
      >
        {title}
      </span>
      {menu ? (
        <span
          contentEditable={false}
          className="absolute top-full left-0 z-20 mt-1 flex min-w-max flex-col gap-1 rounded-lg border border-border bg-bg p-1.5 text-sm shadow-overlay"
        >
          <button
            type="button"
            disabled={pending}
            onMouseDown={(e) => e.preventDefault()}
            onClick={create}
            className="rounded-md px-2 py-1 text-left hover:bg-hover disabled:opacity-60"
          >
            {pending ? "만드는 중…" : `‘${title}’ 생각으로 만들기`}
          </button>
          {error ? <span className="px-2 text-xs text-danger">{error}</span> : null}
        </span>
      ) : null}
    </NodeViewWrapper>
  );
}
