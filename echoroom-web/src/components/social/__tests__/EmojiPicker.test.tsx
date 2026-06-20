import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmojiPicker } from "../EmojiPicker";

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EmojiPicker", () => {
  const defaultEmojis = ["❤️", "😂", "😮", "🔥", "😭", "🤯", "💀", "👀"];

  it("renders 8 emoji buttons", () => {
    render(<EmojiPicker onSelect={vi.fn()} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(8);
  });

  it("renders all expected emojis", () => {
    render(<EmojiPicker onSelect={vi.fn()} />);

    for (const emoji of defaultEmojis) {
      expect(screen.getByText(emoji)).toBeInTheDocument();
    }
  });

  it("each button has proper aria-label", () => {
    render(<EmojiPicker onSelect={vi.fn()} />);

    for (const emoji of defaultEmojis) {
      expect(
        screen.getByRole("button", { name: `Réagir avec ${emoji}` }),
      ).toBeInTheDocument();
    }
  });

  it("calls onSelect with the correct emoji when clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<EmojiPicker onSelect={onSelect} />);

    const heartButton = screen.getByRole("button", { name: "Réagir avec ❤️" });
    await user.click(heartButton);

    expect(onSelect).toHaveBeenCalledWith("❤️");
  });

  it("calls onSelect for different emojis", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<EmojiPicker onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "Réagir avec 🔥" }));
    expect(onSelect).toHaveBeenCalledWith("🔥");

    await user.click(screen.getByRole("button", { name: "Réagir avec 👀" }));
    expect(onSelect).toHaveBeenCalledWith("👀");
  });

  it("highlights the selected emoji with specific classes", () => {
    render(<EmojiPicker onSelect={vi.fn()} selectedEmoji="🔥" />);

    const selectedButton = screen.getByRole("button", { name: "Réagir avec 🔥" });
    // Check for unique selected classes (hover:scale-110 is on ALL buttons)
    expect(selectedButton.className).toContain("bg-primary/20");
    expect(selectedButton.className).toContain("ring-1");
  });

  it("does not highlight unselected emojis", () => {
    render(<EmojiPicker onSelect={vi.fn()} selectedEmoji="🔥" />);

    const unselectedButton = screen.getByRole("button", { name: "Réagir avec ❤️" });
    // Unselected buttons should NOT have bg-primary/20 or ring-1 (only selected gets them)
    // Note: scale-110 exists in hover:scale-110 on ALL buttons, so we can't use it
    expect(unselectedButton.className).not.toContain("bg-primary/20");
    expect(unselectedButton.className).not.toContain("ring-1");
  });

  it("disables all buttons when disabled prop is true", () => {
    render(<EmojiPicker onSelect={vi.fn()} disabled={true} />);

    const buttons = screen.getAllByRole("button");
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });

  it("does not call onSelect when disabled and clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<EmojiPicker onSelect={onSelect} disabled={true} />);

    const button = screen.getByRole("button", { name: "Réagir avec ❤️" });
    await user.click(button);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders buttons in a grid layout", () => {
    const { container } = render(<EmojiPicker onSelect={vi.fn()} />);

    const gridContainer = container.firstChild as HTMLElement;
    expect(gridContainer.className).toContain("grid");
    expect(gridContainer.className).toContain("grid-cols-4");
  });

  it("updates selected emoji when selectedEmoji prop changes", () => {
    const { rerender } = render(
      <EmojiPicker onSelect={vi.fn()} selectedEmoji="❤️" />,
    );

    const initialSelected = screen.getByRole("button", { name: "Réagir avec ❤️" });
    // Check for unique selected classes (hover:scale-110 is on ALL buttons)
    expect(initialSelected.className).toContain("bg-primary/20");
    expect(initialSelected.className).toContain("ring-1");

    rerender(<EmojiPicker onSelect={vi.fn()} selectedEmoji="🔥" />);

    const newSelected = screen.getByRole("button", { name: "Réagir avec 🔥" });
    expect(newSelected.className).toContain("bg-primary/20");
    expect(newSelected.className).toContain("ring-1");

    const oldSelected = screen.getByRole("button", { name: "Réagir avec ❤️" });
    expect(oldSelected.className).not.toContain("bg-primary/20");
    expect(oldSelected.className).not.toContain("ring-1");
  });
});
