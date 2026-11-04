import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { NodeView } from "@tiptap/pm/view";
import { createCodeLowlight } from "./code-highlight";

const COPIED_MS = 1500;
const FAILED_MS = 2000;

export const COPY_LABEL = { idle: "복사", copied: "복사됨", failed: "복사 실패" } as const;

/**
 * Code block with syntax colours (lowlight decorations), a language label and a copy
 * button. The node keeps the name `codeBlock`, so tiptap-markdown reads and writes it as a
 * fenced block (```` ```lang ````) exactly like StarterKit's code block.
 */
export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    const prefix = this.options.languageClassPrefix ?? "language-";
    return ({ node }) => codeBlockView(node, prefix);
  },
}).configure({ lowlight: createCodeLowlight(), defaultLanguage: null });

function languageOf(node: PMNode): string {
  const language: unknown = node.attrs.language;
  return typeof language === "string" ? language.trim() : "";
}

/**
 * `<div.rb-code> <div.rb-code-bar>[복사][ts]</div> <pre><code>…</code></pre> </div>`.
 * The bar sits outside the scrolling `<pre>` so long lines never hide it, and outside the
 * editable content so ProseMirror ignores clicks and DOM changes there.
 */
function codeBlockView(initial: PMNode, prefix: string): NodeView {
  let node = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const dom = document.createElement("div");
  dom.className = "rb-code";

  const bar = document.createElement("div");
  bar.className = "rb-code-bar";
  bar.contentEditable = "false";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "rb-code-copy";
  button.setAttribute("aria-label", "코드 복사");
  button.textContent = COPY_LABEL.idle;

  const label = document.createElement("span");
  label.className = "rb-code-lang";
  label.setAttribute("aria-hidden", "true");

  const status = document.createElement("span");
  status.className = "sr-only";
  status.setAttribute("role", "status");

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  pre.append(code);
  bar.append(button, label, status);
  dom.append(bar, pre);

  const show = (text: string, ms: number) => {
    button.textContent = text;
    status.textContent = text;
    clearTimeout(timer);
    timer = setTimeout(() => {
      button.textContent = COPY_LABEL.idle;
      status.textContent = "";
    }, ms);
  };

  // Keep the editor selection where it is.
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => {
    const text = node.textContent;
    if (!navigator.clipboard) return show(COPY_LABEL.failed, FAILED_MS);
    navigator.clipboard.writeText(text).then(
      () => show(COPY_LABEL.copied, COPIED_MS),
      () => show(COPY_LABEL.failed, FAILED_MS),
    );
  });

  const render = () => {
    const language = languageOf(node);
    label.textContent = language;
    label.hidden = !language;
    code.className = language ? `${prefix}${language}` : "";
    if (language) dom.dataset.language = language;
    else delete dom.dataset.language;
  };
  render();

  return {
    dom,
    contentDOM: code,
    update(next) {
      if (next.type !== node.type) return false;
      node = next;
      render();
      return true;
    },
    stopEvent: (event) => event.target instanceof Node && bar.contains(event.target),
    ignoreMutation: (mutation) => bar.contains(mutation.target),
    destroy: () => clearTimeout(timer),
  };
}
