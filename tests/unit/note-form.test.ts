import { describe, expect, it } from "vitest";
import { parseNoteForm } from "@/app/notes/form";

describe("parseNoteForm", () => {
  it("leaves sourceTitle untouched when the form no longer sends it", () => {
    const form = new FormData();
    form.set("title", "1장 정리");
    form.set("sourceKind", "book");
    form.set("sourceUrl", "");
    expect(parseNoteForm(form).sourceTitle).toBeUndefined();
  });
});
