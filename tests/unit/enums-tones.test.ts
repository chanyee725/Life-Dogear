import { describe, expect, it } from "vitest";
import { BADGE_TONES } from "@/components/ui";
import {
  IMPORTANCE,
  ITEM_TYPE,
  PROJECT_STAGE,
  PROJECT_STATUS,
  READ_STATUS,
  SEMINAR_KIND,
  THOUGHT_KIND,
  THOUGHT_MATURITY,
} from "@/lib/enums";

describe("enum badge tones", () => {
  it("only use tones the Badge component knows", () => {
    const all = [
      ITEM_TYPE,
      PROJECT_STAGE,
      PROJECT_STATUS,
      READ_STATUS,
      IMPORTANCE,
      SEMINAR_KIND,
      THOUGHT_KIND,
      THOUGHT_MATURITY,
    ].flatMap((e) => e.options.map((o) => o.tone));
    for (const tone of all) expect(BADGE_TONES).toContain(tone);
  });
});
