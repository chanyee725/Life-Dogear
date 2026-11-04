import { Schema, type Node as PmNode } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { filterSlashCommands, findSlashTrigger } from "@/components/editor/slash-commands";

// Same node/mark names as the editor (StarterKit).
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
function at(doc: PmNode) {
  let end = 0;
  doc.descendants((node, pos) => {
    if (node.isTextblock && !end) end = pos + 1 + node.content.size;
    return !end;
  });
  const state = EditorState.create({ doc });
  return state.apply(state.tr.setSelection(TextSelection.create(doc, end)));
}

const ids = (q: string, page = true) => filterSlashCommands(q, { page }).map((c) => c.id);

describe("filterSlashCommands", () => {
  it("lists everything for an empty query, without 페이지 when there is no document", () => {
    expect(ids("")).toEqual([
      "page",
      "h2",
      "h3",
      "bullet",
      "ordered",
      "task",
      "quote",
      "code",
      "table",
      "image",
    ]);
    expect(ids("", false)).not.toContain("page");
    expect(ids("page", false)).toEqual([]);
  });

  it("matches Korean labels and English aliases", () => {
    expect(ids("페이지")).toEqual(["page"]);
    expect(ids("page")).toEqual(["page"]);
    expect(ids("할 일")).toEqual(["task"]);
    expect(ids("할일")).toEqual(["task"]);
    expect(ids("TODO")).toEqual(["task"]);
    expect(ids("h2")).toEqual(["h2"]);
    expect(ids("h3")).toEqual(["h3"]);
    expect(ids("제목")).toEqual(["h2", "h3"]);
    expect(ids("list")).toEqual(["bullet"]);
    expect(ids("number")).toEqual(["ordered"]);
    expect(ids("quote")).toEqual(["quote"]);
    expect(ids("code")).toEqual(["code"]);
    expect(ids("table")).toEqual(["table"]);
    expect(ids("image")).toEqual(["image"]);
    expect(ids("사진")).toEqual(["image"]);
  });

  it("puts prefix matches before inner matches", () => {
    expect(ids("목록")).toEqual(["bullet", "ordered"]);
    expect(ids("없는명령")).toEqual([]);
  });
});

describe("findSlashTrigger", () => {
  const trig = (doc: PmNode) => findSlashTrigger(at(doc));

  it("opens at a line start or after a space", () => {
    expect(trig(schema.node("doc", null, [p("/")]))).toEqual({ from: 1, to: 2, query: "" });
    expect(trig(schema.node("doc", null, [p("/h2")]))).toEqual({ from: 1, to: 4, query: "h2" });
    expect(trig(schema.node("doc", null, [p("글 /할 일")]))).toEqual({
      from: 3,
      to: 7,
      query: "할 일",
    });
  });

  it("stays closed mid-word, after a space right after /, in code and inside [[", () => {
    const none = (doc: PmNode) => expect(trig(doc)).toBeNull();
    none(schema.node("doc", null, [p("a/b")]));
    none(schema.node("doc", null, [p("http://x")]));
    none(schema.node("doc", null, [p("/ 띄움")]));
    none(schema.node("doc", null, [schema.node("codeBlock", null, [schema.text("/코드")])]));
    none(schema.node("doc", null, [p(schema.text("/인라인", [schema.mark("code")]))]));
    none(schema.node("doc", null, [p("[[제목 /h2")]));
    none(schema.node("doc", null, [p("/a ", schema.node("wikiLink", { title: "b" }), "c")]));
  });
});
