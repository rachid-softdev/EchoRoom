import { test, expect } from "@playwright/test";
import path from "path";

const REACTION_PATH = path.resolve(
  __dirname,
  "../../src/components/social/ReactionBar.tsx",
);
const EMOJI_PATH = path.resolve(
  __dirname,
  "../../src/components/social/EmojiPicker.tsx",
);

function readReaction(): string {
  return require("fs").readFileSync(REACTION_PATH, "utf-8");
}

function readEmoji(): string {
  return require("fs").readFileSync(EMOJI_PATH, "utf-8");
}

test.describe("ReactionBar component", () => {
  test("ReactionBar is exported as a named export", () => {
    const source = readReaction();
    expect(source).toContain("export function ReactionBar");
  });

  test("ReactionBar imports EmojiPicker", () => {
    const source = readReaction();
    expect(source).toMatch(/import.*EmojiPicker/);
  });

  test("ReactionBar uses social.getReactions query", () => {
    const source = readReaction();
    expect(source).toMatch(/\.social\.getReactions\.useQuery/);
  });

  test("ReactionBar uses social.toggleLike mutation", () => {
    const source = readReaction();
    expect(source).toMatch(/\.social\.toggleLike\.useMutation/);
  });

  test("ReactionBar has '+' button with aria-label Ajouter une réaction", () => {
    const source = readReaction();
    expect(source).toContain('aria-label="Ajouter une réaction"');
    expect(source).toContain("+");
  });

  test("reaction buttons have disabled={toggleMutation.isPending}", () => {
    const source = readReaction();
    // Should apply disabled to reaction buttons when mutation is pending
    expect(source).toMatch(/disabled=\{toggleMutation\.isPending\}/);
  });

  test("EmojiPicker conditional rendering in absolute container", () => {
    const source = readReaction();
    expect(source).toContain("absolute top-full left-0 mt-2");
    expect(source).toContain("shadow-xl");
    expect(source).toContain("EmojiPicker");
  });

  test("toggleMutation success triggers refetch", () => {
    const source = readReaction();
    expect(source).toContain("reactionsQuery.refetch()");
  });

  test("toggleMutation error shows destructive toast", () => {
    const source = readReaction();
    expect(source).toContain('variant: "destructive"');
    expect(source).toContain("Impossible de réagir");
  });
});

test.describe("EmojiPicker component", () => {
  test("EmojiPicker is exported as a named export", () => {
    const source = readEmoji();
    expect(source).toContain("export function EmojiPicker");
  });

  test("renders 8 emojis in a grid grid-cols-4 layout", () => {
    const source = readEmoji();
    expect(source).toContain('grid grid-cols-4 gap-1');
    // Check all 8 emojis are defined
    expect(source).toContain("❤️");
    expect(source).toContain("😂");
    expect(source).toContain("😮");
    expect(source).toContain("🔥");
    expect(source).toContain("😭");
    expect(source).toContain("🤯");
    expect(source).toContain("💀");
    expect(source).toContain("👀");
  });

  test("each emoji button has hover:bg-primary/10 and hover:scale-110", () => {
    const source = readEmoji();
    expect(source).toContain("hover:bg-primary/10 hover:scale-110");
  });

  test("each emoji button has focus-visible ring", () => {
    const source = readEmoji();
    expect(source).toContain("focus-visible:ring-2 focus-visible:ring-primary");
  });

  test("each button has aria-label Réagir avec {emoji}", () => {
    const source = readEmoji();
    expect(source).toContain('aria-label={`Réagir avec ${emoji}`}');
  });

  test("disabled state has opacity-30 and no hover effects", () => {
    const source = readEmoji();
    expect(source).toContain("disabled:opacity-30");
    expect(source).toContain("disabled:hover:scale-100");
  });

  test("selected emoji has bg-primary/20 ring-1 ring-primary scale-110", () => {
    const source = readEmoji();
    expect(source).toContain('isSelected && "bg-primary/20 ring-1 ring-primary scale-110"');
  });
});
