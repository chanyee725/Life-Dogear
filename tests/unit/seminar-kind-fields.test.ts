import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SeminarKindFields } from "@/app/seminars/SeminarKindFields";
import { SEMINAR_KIND } from "@/lib/enums";

const render = (kind: "seminar" | "talk") =>
  renderToStaticMarkup(
    createElement(SeminarKindFields, {
      kind,
      speaker: "기존 연사",
      hostVenue: "기존 장소",
      materialUrl: "https://example.com/a",
    }),
  );

describe("SeminarKindFields", () => {
  it("labels kinds as 들은 것 / 한 것", () => {
    expect(SEMINAR_KIND.label("seminar")).toBe("들은 것");
    expect(SEMINAR_KIND.label("talk")).toBe("한 것");
  });

  it("uses attendee labels for 들은 것", () => {
    const html = render("seminar");
    expect(html).toContain(">연사<");
    expect(html).toContain(">장소·주최<");
    expect(html).toContain(">자료 링크<");
  });

  it("uses presenter labels for 한 것 and keeps existing values", () => {
    const html = render("talk");
    expect(html).toContain(">함께한 사람<");
    expect(html).toContain(">대상·장소<");
    expect(html).toContain(">발표 자료<");
    expect(html).not.toContain(">연사<");
    expect(html).toContain('value="기존 연사"');
    expect(html).toContain('value="기존 장소"');
    expect(html).toContain('value="https://example.com/a"');
  });
});
