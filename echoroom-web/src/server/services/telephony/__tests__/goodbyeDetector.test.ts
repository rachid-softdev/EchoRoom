import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// detectGoodbye — Unicode-aware word-boundary regex tests
// ---------------------------------------------------------------------------
// Pure function: no mocking needed.
// Tests word boundary correctness, phrase matching, case sensitivity,
// and edge cases like empty strings.

describe("detectGoodbye", () => {
  // ---- Word boundary correctness (no false positives) ----
  // M1 requirement: "bye" should NOT match "byepass", "byebye", "byproduct"

  it('should NOT match "bye" inside "byepass"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("byepass")).toBe(false);
  });

  it('should NOT match "bye" inside "byebye" as a single token', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("byebye")).toBe(false);
  });

  it('should NOT match "bye" inside "byproduct"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("byproduct")).toBe(false);
  });

  it('should match "bye" as an isolated word', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("bye")).toBe(true);
  });

  it('should match "bye" with surrounding punctuation', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("bye!")).toBe(true);
    expect(detectGoodbye("(bye)")).toBe(true);
    expect(detectGoodbye('"bye"')).toBe(true);
    expect(detectGoodbye("see you, bye!")).toBe(true);
  });

  it('should NOT match "goodbye" inside "goodbyes"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("goodbyes")).toBe(false);
  });

  it('should NOT match "goodbye" inside "goodbye123"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("goodbye123")).toBe(false);
  });

  it('should NOT match "goodbye" inside "saygoodbye"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("saygoodbye")).toBe(false);
  });

  it('should match "goodbye" as an isolated word', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("goodbye")).toBe(true);
  });

  // ---- French phrases with accents ----

  it('should NOT match "merci" inside "merciless" (non-word boundary)', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    // "merci" at the start of "merciless" is not a standalone word
    expect(detectGoodbye("merciless")).toBe(false);
  });

  it('should NOT match "merci" inside "mercier" (non-word boundary)', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("mercier")).toBe(false);
  });

  it('should match "merci" inside "merci beaucoup" because "merci" is standalone', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    // "merci" is a standalone word in "merci beaucoup" — it correctly matches
    expect(detectGoodbye("merci beaucoup")).toBe(true);
  });

  it('should match "merci" alone', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("merci")).toBe(true);
  });

  it('should match "au revoir" with accents', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("au revoir")).toBe(true);
  });

  it('should match "à bientôt" with accents', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("à bientôt")).toBe(true);
  });

  it('should match "à plus tard"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("à plus tard")).toBe(true);
  });

  it('should match "c\'est tout"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("c'est tout")).toBe(true);
  });

  it('should match "je dois y aller"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("je dois y aller")).toBe(true);
  });

  it('should match "je vous remercie"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("je vous remercie")).toBe(true);
  });

  it('should match "bonne journée"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("bonne journée")).toBe(true);
  });

  it('should match "bonne soirée"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("bonne soirée")).toBe(true);
  });

  // ---- English phrases ----

  it('should match "goodbye"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("goodbye")).toBe(true);
  });

  it('should match "bye"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("bye")).toBe(true);
  });

  it('should match "hang up"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("hang up")).toBe(true);
  });

  it('should match "end call"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("end call")).toBe(true);
  });

  it('should match "i\'m done"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("i'm done")).toBe(true);
  });

  it('should match "that\'s all"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("that's all")).toBe(true);
  });

  it('should match "see you later"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("see you later")).toBe(true);
  });

  it('should match "talk to you later"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("talk to you later")).toBe(true);
  });

  it('should match "i have to go"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("i have to go")).toBe(true);
  });

  it('should match "i gotta go"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("i gotta go")).toBe(true);
  });

  it('should match "bye bye"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("bye bye")).toBe(true);
  });

  it('should match "catch you later"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("catch you later")).toBe(true);
  });

  it('should match "salut"', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("salut")).toBe(true);
  });

  // ---- Case insensitivity ----

  it("should match uppercase GOODBYE", async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("GOODBYE")).toBe(true);
  });

  it("should match mixed case ByE", async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("ByE")).toBe(true);
  });

  it("should match Au Revoir with capital letters", async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("Au Revoir")).toBe(true);
  });

  it("should match uppercase SALUT", async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("SALUT")).toBe(true);
  });

  it("should match uppercase i'm done", async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("I'M DONE")).toBe(true);
  });

  it("should match uppercase SEE YOU LATER", async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("SEE YOU LATER")).toBe(true);
  });

  // ---- Empty / edge cases ----

  it("should return false for empty string", async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("")).toBe(false);
  });

  it("should return false for string with only whitespace", async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("   ")).toBe(false);
  });

  it("should return false for strings with no goodbye phrases", async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("hello world")).toBe(false);
    expect(detectGoodbye("what is the weather")).toBe(false);
    expect(detectGoodbye("i am still here")).toBe(false);
  });

  it("should handle text with numbers that don't form goodbye", async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("call me at 555-1234")).toBe(false);
  });

  it('should match "bye" at the end of a sentence', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("okay thanks bye")).toBe(true);
  });

  it('should match "bye" at the start of text', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("bye for now")).toBe(true);
  });

  // ---- Multiple phrases ----

  it("should detect goodbye in a longer sentence", async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("thank you for the conversation goodbye")).toBe(true);
  });

  it("should detect multiple goodbye phrases", async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("goodbye bye")).toBe(true);
  });

  // ---- Unicode / accented boundaries ----

  it('should handle "merci" at end of sentence with period', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("merci.")).toBe(true);
  });

  it('should NOT match "au revoir" inside "au-revoir" (hyphen breaks the phrase)', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    // "au-revoir" uses a hyphen instead of a space, so the literal
    // phrase "au revoir" (with space) is not present in the text
    expect(detectGoodbye("au-revoir")).toBe(false);
  });

  it('should match "au revoir" surrounded by non-letter characters', async () => {
    const { detectGoodbye } = await import("../goodbyeDetector");
    expect(detectGoodbye("...au revoir...")).toBe(true);
  });
});
