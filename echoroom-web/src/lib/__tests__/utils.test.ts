import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// cn() utility tests
// ---------------------------------------------------------------------------
// Tests for src/lib/utils.ts which re-exports the cn() function from
// @/components/ui/lib. cn() combines clsx and tailwind-merge to merge
// Tailwind CSS classes with conflict resolution.

describe("cn — class name utility", () => {
  it("should merge Tailwind classes (px-4, px-6 → px-6)", async () => {
    const { cn } = await import("../utils");
    // tailwind-merge resolves conflicting utility classes
    const result = cn("px-4", "px-6");
    expect(result).toBe("px-6");
  });

  it("should handle conditional classes (false && 'hidden')", async () => {
    const { cn } = await import("../utils");
    const result = cn("block", false && "hidden", "visible");
    expect(result).toBe("block visible");
    expect(result).not.toContain("hidden");
  });

  it("should handle undefined and null values", async () => {
    const { cn } = await import("../utils");
    const result = cn("base", undefined, null, "extra");
    expect(result).toBe("base extra");
  });

  it("should return empty string when no inputs", async () => {
    const { cn } = await import("../utils");
    const result = cn();
    expect(result).toBe("");
  });

  it("should handle arrays in inputs", async () => {
    const { cn } = await import("../utils");
    const result = cn(["flex", "items-center"], "gap-2");
    expect(result).toBe("flex items-center gap-2");
  });

  it("should handle truthy conditional objects", async () => {
    const { cn } = await import("../utils");
    const result = cn("btn", {
      "btn-primary": true,
      "btn-disabled": false,
    });
    expect(result).toBe("btn btn-primary");
  });

  it("should resolve conflicting classes with tailwind-merge", async () => {
    const { cn } = await import("../utils");
    // p-4 and p-6 conflict, tailwind-merge should keep only p-6
    const result = cn("p-4", "text-lg", "p-6");
    expect(result).toBe("text-lg p-6");
    expect(result).not.toContain("p-4");
  });

  it("should merge multiple class string arguments", async () => {
    const { cn } = await import("../utils");
    const result = cn("a", "b", "c");
    expect(result).toBe("a b c");
  });

  it("should handle nested arrays", async () => {
    const { cn } = await import("../utils");
    const result = cn("a", ["b", ["c", "d"]], "e");
    expect(result).toBe("a b c d e");
  });

  it("should filter out falsy values", async () => {
    const { cn } = await import("../utils");
    const result = cn("a", 0 && "b", "", "c", null, undefined, false);
    expect(result).toBe("a c");
  });
});
