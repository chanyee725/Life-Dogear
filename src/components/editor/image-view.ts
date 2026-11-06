import Image from "@tiptap/extension-image";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Selection } from "@tiptap/pm/state";
import type { EditorView, NodeView } from "@tiptap/pm/view";

export const IMAGE_COPY_LABEL = {
  idle: "사진 복사",
  copied: "복사됨",
  failed: "복사 실패",
} as const;
export const CAPTION_PLACEHOLDER = "캡션 추가";
const COPIED_MS = 1500;
const FAILED_MS = 2500;

const COPY_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

/** Draws `blob` on a canvas and reads it back as PNG (the one image type every clipboard takes). */
async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((png) => (png ? resolve(png) : reject(new Error("no png"))), "image/png"),
  );
}

/**
 * Copies the photo itself (not its URL) to the clipboard as PNG. The ClipboardItem gets a
 * promise so the write starts inside the click, which Safari requires.
 */
export async function copyImage(src: string): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("clipboard unavailable");
  }
  const png = fetch(src).then(async (response) => {
    if (!response.ok) throw new Error(`image ${response.status}`);
    return toPng(await response.blob());
  });
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

/**
 * `<figure.rb-image> <div.rb-image-frame><img>[사진 복사]</div> <input 캡션> <figcaption> </figure>`.
 * The caption is the Markdown alt text (`![캡션](url)`). The input shows while editing,
 * the figcaption while reading (CSS picks one from the editor's contenteditable), and an
 * empty figcaption stays hidden.
 */
function imageView(initial: PMNode, view: EditorView, getPos: () => number | undefined): NodeView {
  let node = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const dom = document.createElement("figure");
  dom.className = "rb-image";

  const frame = document.createElement("div");
  frame.className = "rb-image-frame";
  const img = document.createElement("img");
  img.draggable = false;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "rb-image-copy";
  button.setAttribute("aria-label", IMAGE_COPY_LABEL.idle);
  button.title = IMAGE_COPY_LABEL.idle;
  button.innerHTML = COPY_SVG;
  const badge = document.createElement("span");
  badge.className = "rb-image-copy-status";
  badge.setAttribute("role", "status");
  button.append(badge);
  frame.append(img, button);

  const input = document.createElement("input");
  input.type = "text";
  input.className = "rb-image-caption-input";
  input.placeholder = CAPTION_PLACEHOLDER;
  input.setAttribute("aria-label", "사진 캡션");
  input.spellcheck = false;

  const caption = document.createElement("figcaption");
  caption.className = "rb-image-caption";
  dom.append(frame, input, caption);

  const show = (text: string, ms: number) => {
    badge.textContent = text;
    dom.dataset.copy = text === IMAGE_COPY_LABEL.copied ? "copied" : "failed";
    clearTimeout(timer);
    timer = setTimeout(() => {
      badge.textContent = "";
      delete dom.dataset.copy;
    }, ms);
  };

  // Keep the editor selection where it is; the click must not start a block drag either.
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const src = node.attrs.src as string | null;
    if (!src) return show(IMAGE_COPY_LABEL.failed, FAILED_MS);
    copyImage(src).then(
      () => show(IMAGE_COPY_LABEL.copied, COPIED_MS),
      () => show(IMAGE_COPY_LABEL.failed, FAILED_MS),
    );
  });

  // The figure is draggable (ProseMirror sets it); selecting caption text must not drag it.
  input.addEventListener("pointerdown", () => {
    dom.draggable = false;
  });
  input.addEventListener("blur", () => {
    dom.draggable = true;
  });
  input.addEventListener("input", () => {
    const pos = getPos();
    if (pos === undefined || !view.editable) return;
    const alt = input.value;
    if ((node.attrs.alt ?? "") === alt) return;
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, alt }));
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== "Escape") return;
    if (event.isComposing) return;
    event.preventDefault();
    // Back to the text just after the photo.
    const pos = getPos();
    input.blur();
    view.focus();
    if (pos === undefined) return;
    const $after = view.state.doc.resolve(
      Math.min(pos + node.nodeSize, view.state.doc.content.size),
    );
    view.dispatch(view.state.tr.setSelection(Selection.near($after)));
  });

  const render = () => {
    const src = (node.attrs.src as string | null) ?? "";
    const alt = (node.attrs.alt as string | null) ?? "";
    if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    img.alt = alt;
    const title = node.attrs.title as string | null;
    if (title) img.title = title;
    else img.removeAttribute("title");
    if (input.value !== alt) input.value = alt;
    caption.textContent = alt;
    caption.hidden = !alt.trim();
  };
  render();

  return {
    dom,
    update(next) {
      if (next.type !== node.type) return false;
      node = next;
      render();
      return true;
    },
    stopEvent: (event) =>
      event.target instanceof Node &&
      (input.contains(event.target) || button.contains(event.target)),
    ignoreMutation: () => true,
    destroy: () => clearTimeout(timer),
  };
}

/** The parts of markdown-it and prosemirror-markdown's serializer state used here. */
type InlineToken = { type: string; content: string; children: InlineToken[] | null };
type MarkdownIt = {
  core: { ruler: { push(name: string, rule: (state: { tokens: InlineToken[] }) => void): void } };
};
type SerializerState = {
  write(content: string): void;
  esc(text: string): string;
  closeBlock(node: PMNode): void;
};

/**
 * markdown-it turns `\[` inside an image's alt into a `text_special` token, and its alt
 * renderer drops those (its own text_join pass skips image children), so a caption with
 * brackets lost them on reload. This joins them back into plain text first.
 */
function keepEscapesInAlt(md: MarkdownIt) {
  const fix = (tokens: InlineToken[] | null) => {
    for (const token of tokens ?? []) {
      if (token.type === "text_special") token.type = "text";
      if (token.type === "image" || token.type === "inline") fix(token.children);
    }
  };
  md.core.ruler.push("image_alt_text_special", (state) => fix(state.tokens));
}

/**
 * Block photo with a hover copy button and a one-line caption under it, both centred.
 * Markdown stays `![캡션](url)` (the same output as prosemirror-markdown's image), now
 * closed as a block: the stock serializer wrote the next paragraph straight after the `)`,
 * so `![](url)` and the text below it merged into one line.
 */
export const CaptionedImage = Image.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: PMNode) {
          const { src, alt, title } = node.attrs as {
            src: string;
            alt: string | null;
            title: string | null;
          };
          state.write(
            `![${state.esc(alt ?? "")}](${src.replace(/[()]/g, "\\$&")}` +
              (title ? ` "${title.replace(/"/g, '\\"')}"` : "") +
              ")",
          );
          state.closeBlock(node);
        },
        parse: { setup: keepEscapesInAlt },
      },
    };
  },
  addNodeView() {
    return ({ node, view, getPos }) => imageView(node, view, getPos);
  },
});
