import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Card, EmptyState, ListRow, RowList, Section, Table } from "@/components/ui";

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);

describe("card/list surfaces (shadcn look)", () => {
  it("Card is a rounded-xl card surface with a faint shadow", () => {
    const out = html(createElement(Card, null, "x"));
    expect(out).toContain("rounded-xl");
    expect(out).toContain("bg-card");
    expect(out).toContain("shadow-sm");
  });

  it("linked Card keeps the hover state and lets callers override padding", () => {
    const out = html(createElement(Card, { href: "/a", className: "p-6" }, "x"));
    expect(out).toContain('href="/a"');
    expect(out).toContain("hover:border-border-strong");
    expect(out).toContain("p-6");
    expect(out).not.toMatch(/\bp-4\b/);
  });

  it("RowList matches the card surface and rows clip hover to its corners", () => {
    const out = html(createElement(RowList, null, createElement(ListRow, null, "a")));
    expect(out).toContain("rounded-xl");
    expect(out).toContain("shadow-sm");
    expect(out).toContain("first:rounded-t-[inherit]");
    expect(out).toContain("last:rounded-b-[inherit]");
  });

  it("Table wrapper and empty states share the rounded-xl radius", () => {
    expect(html(createElement(Table, null))).toContain("rounded-xl");
    expect(html(createElement(EmptyState, { title: "t", description: "d" }))).toContain(
      "text-muted-foreground",
    );
  });

  it("Section keeps its labelled landmark", () => {
    const out = html(createElement(Section, { id: "s", title: "제목" }, "x"));
    expect(out).toContain('aria-labelledby="s-heading"');
    expect(out).toContain('id="s-heading"');
  });
});
