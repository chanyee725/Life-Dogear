import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vitest";
import { wikiLinkHtml, wikiLinkPlugin } from "@/components/editor/wikilink-markdown";

const md = new MarkdownIt({ html: false });
wikiLinkPlugin(md as never);
wikiLinkPlugin(md as never); // second install is ignored

describe("wikiLinkPlugin", () => {
  it("renders [[title]] as wiki-link spans outside code and quotes", () => {
    const html = md.render(
      "읽기 [[논문 A]] 와 \\[\\[목표\\]\\]\n\n`[[코드]]`\n\n> [[인용]]\n\n```\n[[블록]]\n```\n\n- [[목록]]",
    );
    expect(html).toContain(wikiLinkHtml("논문 A"));
    expect(html).toContain(wikiLinkHtml("목표"));
    expect(html).toContain(wikiLinkHtml("목록"));
    expect(html).toContain("<code>[[코드]]</code>");
    expect(html).toContain("<p>[[인용]]</p>");
    expect(html).toContain("[[블록]]\n</code>");
  });

  it("escapes titles and keeps raw HTML escaped", () => {
    expect(md.render('[[a "<b>"]] <i>x</i>')).toBe(
      '<p><span data-wikilink="a &quot;&lt;b&gt;&quot;">a &quot;&lt;b&gt;&quot;</span> &lt;i&gt;x&lt;/i&gt;</p>\n',
    );
  });
});
