"use client";

import type { Editor } from "@tiptap/core";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type RefObject } from "react";
import { createSlashPage } from "@/app/_actions/slash-page";
import { safeAction } from "@/components/links/safe-action";
import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/Input";
import type { ItemRef } from "@/lib/repo/shared";
import {
  filterSlashCommands,
  findSlashTrigger,
  isImeKey,
  settleSlashTrigger,
  SLASH_COMMANDS,
  type SlashCommand,
  type SlashTrigger,
} from "./slash-commands";
import { invalidateWikiTitles } from "./wiki-resolver";
import { insertWikiLink } from "./WikiLink";
import { useFollowScroll } from "./use-follow-scroll";
import type { SuggestKeyHandler } from "./WikiSuggest";

/** Applies a block command at the cursor (the `/query` is already removed). */
function runBlockCommand(editor: Editor, id: SlashCommand["id"]) {
  const chain = editor.chain().focus();
  switch (id) {
    case "h2":
      return chain.setHeading({ level: 2 }).run();
    case "h3":
      return chain.setHeading({ level: 3 }).run();
    case "bullet":
      return editor.isActive("bulletList") || chain.toggleBulletList().run();
    case "ordered":
      return editor.isActive("orderedList") || chain.toggleOrderedList().run();
    case "task":
      return editor.isActive("taskList") || chain.toggleTaskList().run();
    case "quote":
      return editor.isActive("blockquote") || chain.toggleBlockquote().run();
    case "code":
      return chain.setCodeBlock().run();
    case "table":
      return chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    default:
      return SLASH_COMMANDS.find((c) => c.id === id)?.run?.(editor) ?? false;
  }
}

/**
 * `/` command menu: at a line start or after a space, `/` lists blocks to insert.
 * ↑/↓ choose, Enter/Tab apply, Esc closes (until the cursor leaves this `/`). Typing
 * filters. 페이지 asks for a title, creates a note tied to `doc` and inserts `[[title]]`;
 * it is hidden when there is no saved document yet.
 */
export function SlashMenu({
  editor,
  keyHandler,
  doc,
  onPickImages,
}: {
  editor: Editor;
  keyHandler: RefObject<SuggestKeyHandler | null>;
  doc: ItemRef | null;
  onPickImages: (files: File[]) => void;
}) {
  const [trigger, setTrigger] = useState<SlashTrigger | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  /** Cursor position waiting for a page title (the `/페이지` is already removed). */
  const [pageAt, setPageAt] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const update = () => {
      const found = editor.isEditable ? findSlashTrigger(editor.state) : null;
      // Leaving the `/` forgets an Esc, so a `/` typed again at the same spot opens.
      if (!found) setDismissedAt(null);
      setTrigger((prev) => settleSlashTrigger(prev, found, editor.view.composing));
    };
    const close = () => setTrigger(null);
    // ProseMirror may not dispatch again once composition ends: apply the settled query.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      if (!editor.isFocused) return;
      update();
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!editor.isDestroyed && editor.isFocused) update();
      }, 30);
    };
    // On the document (bubbling): the editor view may not be mounted yet, and by the
    // time the event gets here ProseMirror has already left its composing state.
    editor.on("transaction", update);
    editor.on("blur", close);
    document.addEventListener("compositionend", settle);
    return () => {
      clearTimeout(timer);
      editor.off("transaction", update);
      editor.off("blur", close);
      document.removeEventListener("compositionend", settle);
    };
  }, [editor]);

  const query = trigger?.query ?? "";
  const options = trigger ? filterSlashCommands(query, { page: doc !== null }) : [];
  const open = trigger !== null && trigger.from !== dismissedAt && options.length > 0;

  // A new query starts at the top.
  useEffect(() => setActive(0), [query]);

  const choose = (command: SlashCommand | undefined) => {
    if (!trigger || !command) return;
    editor.chain().focus().deleteRange({ from: trigger.from, to: trigger.to }).run();
    if (command.id === "page") setPageAt(editor.state.selection.from);
    else if (command.id === "image") fileInput.current?.click();
    else runBlockCommand(editor, command.id);
  };

  const chooseRef = useRef(choose);
  useEffect(() => {
    chooseRef.current = choose;
  });

  useEffect(() => {
    keyHandler.current = (event) => {
      if (!open || isImeKey(event)) return false;
      switch (event.key) {
        case "ArrowDown":
          setActive((i) => (i + 1) % options.length);
          return true;
        case "ArrowUp":
          setActive((i) => (i - 1 + options.length) % options.length);
          return true;
        case "Enter":
        case "Tab":
          chooseRef.current(options[Math.min(active, options.length - 1)]);
          return true;
        case "Escape":
          setDismissedAt(trigger!.from);
          return true;
        default:
          return false;
      }
    };
    return () => {
      keyHandler.current = null;
    };
  });

  // The page title prompt follows the scroll itself.
  useFollowScroll(open && pageAt === null);

  const picker = (
    <input
      ref={fileInput}
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      multiple
      hidden
      data-testid="slash-image-input"
      onChange={(e) => {
        const files = [...(e.target.files ?? [])];
        e.target.value = "";
        onPickImages(files);
      }}
    />
  );

  if (pageAt !== null && doc) {
    return (
      <>
        {picker}
        <PageTitlePrompt editor={editor} at={pageAt} doc={doc} onClose={() => setPageAt(null)} />
      </>
    );
  }
  if (!open) return picker;
  const coords = editor.view.coordsAtPos(trigger.from);

  return (
    <>
      {picker}
      <div
        role="listbox"
        aria-label="블록 넣기"
        style={{ position: "fixed", top: coords.bottom + 4, left: coords.left }}
        className="z-30 flex max-h-80 w-56 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-bg p-1 text-sm shadow-overlay"
      >
        {options.map((option, i) => (
          <button
            key={option.id}
            type="button"
            role="option"
            aria-selected={i === active}
            // Keep focus (and the cursor) in the editor.
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(option)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left",
              i === active ? "bg-hover" : "hover:bg-hover",
            )}
          >
            <span
              aria-hidden="true"
              className="w-6 shrink-0 text-center font-mono text-xs text-muted"
            >
              {option.icon}
            </span>
            <span className="min-w-0 truncate">{option.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/** Title box for 페이지; Enter creates the note and inserts `[[title]]` at `at`. */
function PageTitlePrompt({
  editor,
  at,
  doc,
  onClose,
}: {
  editor: Editor;
  at: number;
  doc: ItemRef;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useFollowScroll(true);
  const coords = editor.view.coordsAtPos(Math.min(at, editor.state.doc.content.size));

  const back = () => {
    onClose();
    editor.chain().focus(at).run();
  };

  const submit = () =>
    startTransition(async () => {
      const result = await safeAction(() => createSlashPage(title, doc));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (editor.isDestroyed) return;
      const pos = Math.min(at, editor.state.doc.content.size);
      onClose();
      insertWikiLink(editor, pos, pos, result.data.title);
      invalidateWikiTitles();
      router.refresh();
    });

  return (
    <div
      style={{ position: "fixed", top: coords.bottom + 4, left: coords.left }}
      className="z-30 flex w-72 flex-col gap-1 rounded-lg border border-border bg-bg p-1.5 text-sm shadow-overlay"
    >
      <Input
        size="sm"
        autoFocus
        aria-label="새 페이지 제목"
        placeholder="새 페이지 제목"
        value={title}
        disabled={pending}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (!pending) onClose();
        }}
        onKeyDown={(e) => {
          if (isImeKey(e.nativeEvent)) return;
          if (e.key === "Enter") {
            // Never submit the surrounding form.
            e.preventDefault();
            if (title.trim()) submit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            back();
          }
        }}
      />
      {pending ? <span className="px-1 text-xs text-muted">만드는 중…</span> : null}
      {error ? (
        <span role="alert" className="px-1 text-xs text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
