"use client";

import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EDITOR_READY_EVENT } from "@/components/fields/form-patch";
import { cn } from "@/components/ui/cn";
import { createExtensions } from "./extensions";
import { insertImages, isImageFile } from "./image-upload";
import { itemFromPath } from "./wiki-resolver";
import { WikiRenamePrompt } from "./WikiRenamePrompt";
import { WikiSuggest, type SuggestKeyHandler } from "./WikiSuggest";

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
 * Supports headings, lists, checklists, tables, quotes, code, links and `[[title]]`
 * wiki links (`[[` opens a title search).
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
  const suggestKeys = useRef<SuggestKeyHandler | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const [uploading, setUploading] = useState(0);
  const [imageError, setImageError] = useState<string | null>(null);

  async function addImages(files: File[], pos?: number) {
    const editor = editorRef.current;
    if (!editor || files.length === 0) return;
    setImageError(null);
    setUploading((n) => n + files.length);
    const error = await insertImages(editor, files, pos);
    setUploading((n) => Math.max(0, n - files.length));
    if (error) setImageError(error);
  }
  const addImagesRef = useRef(addImages);
  useEffect(() => {
    addImagesRef.current = addImages;
  });
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
      handleKeyDown: (_view, event) => suggestKeys.current?.(event) ?? false,
      // Pasted or dropped photos are uploaded and inserted as images.
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter(isImageFile);
        if (files.length === 0) return false;
        event.preventDefault();
        void addImagesRef.current(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = [...(event.dataTransfer?.files ?? [])].filter(isImageFile);
        if (files.length === 0) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void addImagesRef.current(files, pos);
        return true;
      },
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

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {toolbar && editable && editor ? (
        <Toolbar editor={editor} onPickImages={(files) => void addImages(files)} />
      ) : null}
      <EditorContent editor={editor} />
      {uploading > 0 ? (
        <p aria-live="polite" className="text-xs text-muted">
          사진 올리는 중…
        </p>
      ) : null}
      {imageError ? (
        <p role="alert" className="text-xs text-danger">
          {imageError}
        </p>
      ) : null}
      {editor && editable ? <WikiSuggest editor={editor} keyHandler={suggestKeys} /> : null}
      {name ? <HiddenValue name={name} editor={editor} initial={value} /> : null}
      {name && editable ? <FormTitleRename /> : null}
    </div>
  );
}

/**
 * On a detail page whose editor sits in a form with a `title` field (the shared
 * ItemForm), offers to update `[[옛 제목]]` in other bodies after a rename.
 * Editors outside such a form (the paper page) render `WikiRenamePrompt` themselves.
 */
function FormTitleRename() {
  const item = itemFromPath(usePathname());
  const probe = useRef<HTMLSpanElement>(null);
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    const input = probe.current
      ?.closest("form")
      ?.querySelector<HTMLInputElement>('input[name="title"]');
    if (!input) return;
    setTitle(input.value);
    const onInput = () => setTitle(input.value);
    input.addEventListener("input", onInput);
    return () => input.removeEventListener("input", onInput);
  }, []);

  return (
    <span ref={probe} className="contents">
      {item && title !== null ? <WikiRenamePrompt item={item} title={title} /> : null}
    </span>
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
    // Tiptap can emit an `update` right after mount (normalization) without a real edit.
    // Baseline for "changed?": the loaded document, then whatever was last submitted.
    let loadedDoc = editor.state.doc;
    const sync = () => {
      // Toolbar commands change the document without a DOM input event; announce real
      // edits so the surrounding form can track unsaved changes.
      if (!editor.state.doc.eq(loadedDoc))
        input.dispatchEvent(new Event("input", { bubbles: true }));
      clearTimeout(timer);
      timer = setTimeout(() => {
        input.value = getMarkdown(editor);
      }, HIDDEN_SYNC_MS);
    };
    const onFormData = (event: FormDataEvent) => {
      loadedDoc = editor.state.doc;
      const markdown = getMarkdown(editor);
      input.value = markdown;
      event.formData.set(name, markdown);
    };
    const form = input.form;
    // The editor may re-serialise the stored Markdown (same content, different text).
    // Publish that form once it is ready so autosave can use it as the baseline.
    input.value = getMarkdown(editor);
    input.dispatchEvent(new Event(EDITOR_READY_EVENT, { bubbles: true }));
    editor.on("update", sync);
    form?.addEventListener("formdata", onFormData);
    return () => {
      clearTimeout(timer);
      // Leave the final text in the input so a form read during unmount still has it.
      if (!editor.isDestroyed) input.value = getMarkdown(editor);
      editor.off("update", sync);
      form?.removeEventListener("formdata", onFormData);
    };
  }, [editor, name]);

  return <input ref={ref} type="hidden" name={name} defaultValue={initial} />;
}

function Toolbar({
  editor,
  onPickImages,
}: {
  editor: Editor;
  onPickImages: (files: File[]) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
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
      <Tool
        label="사진 넣기 (붙여넣기·끌어다 놓기도 됩니다)"
        onClick={() => fileInput.current?.click()}
      >
        사진
      </Tool>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          onPickImages(files);
        }}
      />
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
