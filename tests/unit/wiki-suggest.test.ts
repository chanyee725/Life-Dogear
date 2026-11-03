import { Schema, type Node as PmNode } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { itemFromPath } from "@/components/editor/wiki-resolver";
import { findWikiTrigger } from "@/components/editor/WikiSuggest";

// Same node/mark names as the editor (StarterKit): what findWikiTrigger looks at.
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    blockquote: { group: "block", content: "block+" },
    codeBlock: { group: "block", content: "text*", code: true, marks: "" },
    wikiLink: { group: "inline", inline: true, atom: true, attrs: { title: { default: "" } } },
    text: { group: "inline" },
  },
  marks: { code: {} },
});

const p = (...content: (PmNode | string)[]) =>
  schema.node(
    "paragraph",
    null,
    content.map((c) => (typeof c === "string" ? schema.text(c) : c)),
  );

/** State with the cursor at the end of the first textblock. */
function at(doc: PmNode, offsetFromEnd = 0) {
  let end = 0;
  doc.descendants((node, pos) => {
    if (node.isTextblock && !end) end = pos + 1 + node.content.size;
    return !end;
  });
  const state = EditorState.create({ doc });
  return state.apply(state.tr.setSelection(TextSelection.create(doc, end - offsetFromEnd)));
}

describe("findWikiTrigger", () => {
  it("finds the open [[query before the cursor", () => {
    const doc = schema.node("doc", null, [p("읽은 [[논문 A")]);
    expect(findWikiTrigger(at(doc))).toEqual({ from: 4, to: 10, query: "논문 A" });
    expect(findWikiTrigger(at(schema.node("doc", null, [p("[[")])))).toMatchObject({
      query: "",
    });
  });

  it("ignores closed links, quotes, code and text across an atom", () => {
    const none = (doc: PmNode) => expect(findWikiTrigger(at(doc))).toBeNull();
    none(schema.node("doc", null, [p("[[닫힘]] 뒤")]));
    none(schema.node("doc", null, [p("한 [ 개")]));
    none(schema.node("doc", null, [schema.node("blockquote", null, [p("> [[인용")])]));
    none(schema.node("doc", null, [schema.node("codeBlock", null, [schema.text("[[코드")])]));
    none(schema.node("doc", null, [p(schema.text("[[인라인", [schema.mark("code")]))]));
    none(schema.node("doc", null, [p("[[a ", schema.node("wikiLink", { title: "b" }), " c")]));
  });
});

describe("itemFromPath", () => {
  const id = "0b4f9f7e-2d5c-4a51-9a39-6f0c4b6b9c11";
  it("reads detail pages only", () => {
    expect(itemFromPath(`/papers/${id}`)).toEqual({ type: "paper", id });
    expect(itemFromPath(`/goals/${id}/`)).toEqual({ type: "goal", id });
    expect(itemFromPath("/goals/new")).toBeNull();
    expect(itemFromPath("/goals")).toBeNull();
    expect(itemFromPath(`/unknown/${id}`)).toBeNull();
    expect(itemFromPath(null)).toBeNull();
  });
});
