import { describe, expect, it } from "vitest";
import { archive, goals, tags, thoughts } from "@/lib/repo";
import * as reviews from "@/lib/repo/reviews";
import { useFreshDb } from "./repo-helpers";

describe("tags.listAll({ visibleOnly })", () => {
  it("leaves out tags only on archived goals and reviews", async () => {
    await useFreshDb();
    const g = await goals.create({ title: "목표", horizon: "life", tags: ["목표만"] });
    const { review } = await reviews.open("week", "2026-W45");
    const R = { type: "review" as const, id: review.id };
    await tags.setTags(R, ["회고만", "공유"]);
    await thoughts.create({ title: "생각", tags: ["공유"] });

    const names = async () =>
      (await tags.listAll({ visibleOnly: true })).map((t) => [t.name, t.count]);
    expect(await names()).toEqual([
      ["공유", 2],
      ["목표만", 1],
      ["회고만", 1],
    ]);
    await archive.archive({ type: "goal", id: g.id });
    await archive.archive(R);
    expect(await names()).toEqual([["공유", 1]]);
    // Suggestions still offer every tag.
    expect((await tags.listAll()).map((t) => t.name)).toEqual(["공유", "목표만", "회고만"]);
  });
});
