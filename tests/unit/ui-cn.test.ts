import { describe, expect, it } from "vitest";
import { cn } from "@/components/ui/cn";

describe("cn", () => {
  it("skips falsy parts and keeps unrelated classes", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
    expect(cn()).toBe("");
  });

  it("lets later Tailwind classes override conflicting earlier ones", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("h-9", "h-11")).toBe("h-11");
    expect(cn("rounded-lg", "rounded-md")).toBe("rounded-md");
    expect(cn("text-muted", "text-danger")).toBe("text-danger");
  });

  it("keeps font size and color together, including design tokens", () => {
    expect(cn("text-sm", "text-fg")).toBe("text-sm text-fg");
    expect(cn("text-[13px]", "text-muted")).toBe("text-[13px] text-muted");
    expect(cn("bg-tone-gray-bg text-tone-gray-fg", "border-border")).toBe(
      "bg-tone-gray-bg text-tone-gray-fg border-border",
    );
  });
});
