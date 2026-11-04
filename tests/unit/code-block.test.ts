import { Editor, type JSONContent } from "@tiptap/core";
import MarkdownIt from "markdown-it";
import { afterEach, describe, expect, it } from "vitest";
import { createCodeLowlight } from "@/components/editor/code-highlight";
import { createExtensions } from "@/components/editor/extensions";

type Hast = { type: string; value?: string; children?: Hast[] };
const hasElements = (node: Hast): boolean =>
  node.type === "element" || (node.children ?? []).some(hasElements);

describe("code highlighting", () => {
  const lowlight = createCodeLowlight();

  it("registers only the languages we use, with their aliases", () => {
    expect(lowlight.listLanguages().sort()).toEqual([
      "bash",
      "c",
      "cpp",
      "javascript",
      "json",
      "python",
      "shell",
      "typescript",
      "xml",
      "yaml",
    ]);
    for (const alias of [
      "sh",
      "shell",
      "yml",
      "launch",
      "html",
      "c",
      "h",
      "cpp",
      "hpp",
      "py",
      "json",
      "ts",
      "js",
    ])
      expect(lowlight.registered(alias), alias).toBe(true);
    // Not bundled: lowlight's `common`/`all` sets are never loaded.
    for (const other of ["rust", "go", "java", "sql", "css", "markdown"])
      expect(lowlight.registered(other), other).toBe(false);
  });

  it("colours known languages", () => {
    expect(hasElements(lowlight.highlight("launch", '<launch><node pkg="a"/></launch>'))).toBe(
      true,
    );
    expect(hasElements(lowlight.highlight("ts", "const a: number = 1;"))).toBe(true);
  });

  it("never auto-detects: unknown or missing languages stay plain text", () => {
    const root = lowlight.highlightAuto("def f():\n  return 1");
    expect(hasElements(root as Hast)).toBe(false);
    expect(root.children).toEqual([{ type: "text", value: "def f():\n  return 1" }]);
  });
});

describe("code block Markdown round trip", () => {
  let editor: Editor | undefined;
  afterEach(() => editor?.destroy());

  const block = (language: string | null, text: string): JSONContent => ({
    type: "codeBlock",
    attrs: { language },
    content: [{ type: "text", text }],
  });
  const toMarkdown = (content: JSONContent[]) => {
    editor = new Editor({
      element: null,
      extensions: createExtensions(""),
      content: { type: "doc", content },
    });
    return (
      editor.storage as unknown as { markdown: { getMarkdown(): string } }
    ).markdown.getMarkdown();
  };

  /** Parse half (DOM-free): markdown-it with tiptap-markdown's langPrefix, then the node's parse rule. */
  const parsedLanguage = (markdown: string) => {
    toMarkdown([]);
    const md = new MarkdownIt({ html: false }).set({ langPrefix: "language-" });
    const match = /<pre><code(?: class="([^"]*)")?>/.exec(md.render(markdown));
    expect(match).not.toBeNull();
    const classes = (match![1] ?? "").split(" ").filter(Boolean);
    const rule = editor!.schema.nodes.codeBlock!.spec.parseDOM!.find(
      (r) => "tag" in r && r.tag === "pre",
    )!;
    const stub = {
      firstElementChild: { classList: classes },
      getAttribute: () => null,
      hasAttribute: () => false,
    } as unknown as HTMLElement;
    const attrs = "getAttrs" in rule && rule.getAttrs ? rule.getAttrs(stub) : {};
    return (attrs as { language?: string | null }).language ?? null;
  };

  it.each([
    ["a registered language", "ts", "const a = 1;"],
    ["an alias", "launch", '<launch>\n  <node pkg="a"/>\n</launch>'],
    ["an unknown language", "mermaid", "graph TD\n  A --> B"],
  ])("keeps ```lang for %s", (_, language, code) => {
    const markdown = toMarkdown([block(language, code)]);
    expect(markdown).toBe("```" + language + "\n" + code + "\n```");
    expect(parsedLanguage(markdown)).toBe(language);
  });

  it("keeps a fence without a language", () => {
    const markdown = toMarkdown([block(null, "plain text")]);
    expect(markdown).toBe("```\nplain text\n```");
    expect(parsedLanguage(markdown)).toBeNull();
  });

  it("keeps surrounding content and several blocks in order", () => {
    const markdown = toMarkdown([
      { type: "paragraph", content: [{ type: "text", text: "앞" }] },
      block("bash", "echo hi"),
      block(null, "x"),
      block("yaml", "a: 1"),
    ]);
    expect(markdown).toBe("앞\n\n```bash\necho hi\n```\n\n```\nx\n```\n\n```yaml\na: 1\n```");
  });
});
