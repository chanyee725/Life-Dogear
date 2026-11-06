// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { createExtensions } from "@/components/editor/extensions";

let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
  document.body.innerHTML = "";
});

function mount(markdown: string) {
  const element = document.createElement("div");
  document.body.append(element);
  editor = new Editor({ element, extensions: createExtensions(""), content: markdown });
  return editor;
}
const md = (e: Editor) =>
  (e.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();
const image = (e: Editor) => e.getJSON().content?.find((n) => n.type === "image");

const SRC = "/api/images/00000000-0000-0000-0000-000000000000.png";

describe("image width (free percent, w=37)", () => {
  it("reads w=37 as width 37 and saves it back", () => {
    const src = `![캡션](${SRC} "w=37")`;
    const e = mount(src);
    expect(image(e)?.attrs?.width).toBe(37);
    expect(md(e)).toBe(src);
  });

  it("is stable on a second save", () => {
    const first = md(mount(`![](${SRC} "w=37")`));
    editor?.destroy();
    expect(md(mount(first))).toBe(first);
  });

  it.each([25, 50, 75, 100])("keeps the preset w=%i unchanged", (w) => {
    const src = `![](${SRC} "w=${w}")`;
    const e = mount(src);
    expect(image(e)?.attrs?.width).toBe(w);
    expect(md(e)).toBe(src);
  });

  it("a photo without a width stays plain", () => {
    const e = mount(`![](${SRC})`);
    expect(image(e)?.attrs?.width ?? null).toBeNull();
    expect(md(e)).toBe(`![](${SRC})`);
  });

  it.each(["w=0", "w=-5", "w=101", "w=1000", "w=abc", "w=", "w=37.5", "w=37%", "W=37x"])(
    "ignores an out-of-range or odd value (%s)",
    (title) => {
      const e = mount(`![](${SRC} "${title}")`);
      expect(image(e)?.attrs?.width ?? null).toBeNull();
      expect(image(e)?.attrs?.src).toBe(SRC);
    },
  );

  it("shows the free width on the figure", () => {
    const e = mount(`![](${SRC} "w=37")`);
    const figure = e.view.dom.querySelector<HTMLElement>("figure.rb-image")!;
    expect(figure.dataset.width).toBe("37");
  });
});
