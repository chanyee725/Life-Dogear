"use client";

import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { createExtensions } from "./extensions";

type MarkdownStorage = { markdown: { getMarkdown: () => string } };

export function getMarkdown(editor: Editor): string {
  return (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown();
}

export type MarkdownEditorProps = {
  /** Markdown source. */
  value: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
  /** When set, a hidden input with this name carries the markdown, so the editor works inside a plain <form>. */
  name?: string;
  editable?: boolean;
  /** Hide the formatting toolbar (markdown input rules like `## `, `- [ ] ` still work). */
  toolbar?: boolean;
  className?: string;
  autoFocus?: boolean;
};

/**
 * Block editor that reads and writes Markdown (Tiptap + tiptap-markdown).
 * Supports headings, lists, checklists, tables, quotes, code and links.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = "내용을 입력하세요…",
  name,
  editable = true,
  toolbar = true,
  className,
  autoFocus = false,
}: MarkdownEditorProps) {
  // Last markdown we emitted or loaded; lets us ignore our own value echoing back.
  const lastMarkdown = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: createExtensions(placeholder),
    content: value,
    editable,
    autofocus: autoFocus ? "end" : false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "rb-prose", "aria-label": "본문", spellcheck: "false" },
    },
    onUpdate: ({ editor }) => {
      const markdown = getMarkdown(editor);
      if (markdown === lastMarkdown.current) return;
      lastMarkdown.current = markdown;
      onChangeRef.current?.(markdown);
    },
  });

  // External value changes (e.g. a server refresh) replace the content, but never while the
  // user is typing: that would drop keystrokes. To switch items, remount with `key={id}`.
  useEffect(() => {
    if (!editor || editor.isFocused || value === lastMarkdown.current) return;
    lastMarkdown.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {toolbar && editable && editor ? <Toolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
      {name ? <HiddenValue name={name} editor={editor} initial={value} /> : null}
    </div>
  );
}

const HIDDEN_SYNC_MS = 300;

/**
 * Hidden form field carrying the markdown. Serializing on every keystroke is costly, so the
 * input is refreshed on a short debounce, and the exact value is written into FormData at
 * submit time via the `formdata` event (fired by `new FormData(form)`, which React uses).
 */
function HiddenValue({
  name,
  editor,
  initial,
}: {
  name: string;
  editor: Editor | null;
  initial: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = ref.current;
    if (!editor || !input) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        input.value = getMarkdown(editor);
      }, HIDDEN_SYNC_MS);
    };
    const onFormData = (event: FormDataEvent) => {
      const markdown = getMarkdown(editor);
      input.value = markdown;
      event.formData.set(name, markdown);
    };
    const form = input.form;
    editor.on("update", sync);
    form?.addEventListener("formdata", onFormData);
    return () => {
      clearTimeout(timer);
      editor.off("update", sync);
      form?.removeEventListener("formdata", onFormData);
    };
  }, [editor, name]);

  return <input ref={ref} type="hidden" name={name} defaultValue={initial} />;
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      task: editor.isActive("taskList"),
      quote: editor.isActive("blockquote"),
      code: editor.isActive("code"),
      codeBlock: editor.isActive("codeBlock"),
      table: editor.isActive("table"),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label="서식"
      className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-0.5 bg-bg/90 px-1 py-1 backdrop-blur"
    >
      <Tool
        label="머리글 2"
        active={state.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      >
        H2
      </Tool>
      <Tool
        label="머리글 3"
        active={state.h3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      >
        H3
      </Tool>
      <Divider />
      <Tool label="굵게" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <span className="font-bold">B</span>
      </Tool>
      <Tool label="기울임" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <span className="italic">I</span>
      </Tool>
      <Tool label="인라인 코드" active={state.code} onClick={() => chain().toggleCode().run()}>
        <span className="font-mono text-xs">{"`c`"}</span>
      </Tool>
      <Divider />
      <Tool
        label="글머리 목록"
        active={state.bullet}
        onClick={() => chain().toggleBulletList().run()}
      >
        • 목록
      </Tool>
      <Tool
        label="번호 목록"
        active={state.ordered}
        onClick={() => chain().toggleOrderedList().run()}
      >
        1. 목록
      </Tool>
      <Tool label="체크리스트" active={state.task} onClick={() => chain().toggleTaskList().run()}>
        ☐ 할 일
      </Tool>
      <Tool label="인용" active={state.quote} onClick={() => chain().toggleBlockquote().run()}>
        인용
      </Tool>
      <Tool
        label="코드 블록"
        active={state.codeBlock}
        onClick={() => chain().toggleCodeBlock().run()}
      >
        코드
      </Tool>
      <Divider />
      {state.table ? (
        <>
          <Tool label="아래에 행 추가" onClick={() => chain().addRowAfter().run()}>
            + 행
          </Tool>
          <Tool label="오른쪽에 열 추가" onClick={() => chain().addColumnAfter().run()}>
            + 열
          </Tool>
          <Tool label="행 삭제" onClick={() => chain().deleteRow().run()}>
            − 행
          </Tool>
          <Tool label="열 삭제" onClick={() => chain().deleteColumn().run()}>
            − 열
          </Tool>
          <Tool label="표 삭제" onClick={() => chain().deleteTable().run()}>
            표 삭제
          </Tool>
        </>
      ) : (
        <Tool
          label="표 삽입"
          onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          표
        </Tool>
      )}
    </div>
  );
}

function Tool({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      // Keep the editor selection when clicking toolbar buttons.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "h-7 min-w-7 rounded-md px-2 text-[13px] transition-colors",
        active ? "bg-hover text-fg" : "text-muted hover:bg-hover hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />;
}
