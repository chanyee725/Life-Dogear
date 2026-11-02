import { cleanTitle } from "@/lib/wikilinks";

/**
 * markdown-it pieces for `[[title]]` (kept free of markdown-it imports: the parser
 * instance comes from tiptap-markdown). Mirrors `extractWikiTitles`: inline code and code
 * blocks are separate tokens and never touched; text inside quotes stays plain text.
 */

type Token = {
  type: string;
  content: string;
  children: Token[] | null;
};
type TokenCtor = new (type: string, tag: string, nesting: number) => Token;
type CoreState = { tokens: Token[]; Token: TokenCtor };
export type MarkdownItLike = {
  core: { ruler: { push: (name: string, fn: (state: CoreState) => void) => void } };
};

const LINK_RE = /\[\[([^[\]\n]+)\]\]/g;

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** HTML the editor's `wikiLink` node is parsed from. */
export const wikiLinkHtml = (title: string) =>
  `<span data-wikilink="${escapeAttr(title)}">${escapeAttr(title)}</span>`;

function splitText(text: Token, Token: TokenCtor): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of text.content.matchAll(LINK_RE)) {
    const title = cleanTitle(m[1]);
    if (!title) continue;
    if (m.index > last) {
      const t = new Token("text", "", 0);
      t.content = text.content.slice(last, m.index);
      out.push(t);
    }
    const html = new Token("html_inline", "", 0);
    html.content = wikiLinkHtml(title);
    out.push(html);
    last = m.index + m[0].length;
  }
  if (!out.length) return [text];
  if (last < text.content.length) {
    const t = new Token("text", "", 0);
    t.content = text.content.slice(last);
    out.push(t);
  }
  return out;
}

const INSTALLED = Symbol.for("rb.wikiLink");

/**
 * Core rule: turns `[[title]]` in text tokens (outside quotes) into wiki-link HTML.
 * tiptap-markdown runs `setup` before every parse, so installing twice is a no-op.
 */
export function wikiLinkPlugin(md: MarkdownItLike): void {
  const flagged = md as MarkdownItLike & { [INSTALLED]?: true };
  if (flagged[INSTALLED]) return;
  flagged[INSTALLED] = true;
  md.core.ruler.push("wiki_link", (state) => {
    let quoteDepth = 0;
    for (const token of state.tokens) {
      if (token.type === "blockquote_open") quoteDepth++;
      else if (token.type === "blockquote_close") quoteDepth--;
      else if (token.type === "inline" && quoteDepth === 0 && token.children) {
        token.children = token.children.flatMap((child) =>
          child.type === "text" ? splitText(child, state.Token) : [child],
        );
      }
    }
  });
}
