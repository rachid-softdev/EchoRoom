import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoAudioForm } from "../DemoAudioForm";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DemoAudioForm", () => {
  it("renders email input and submit button", () => {
    render(<DemoAudioForm />);

    const input = screen.getByPlaceholderText("votre@email.com");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "email");

    const button = screen.getByRole("button", { name: "Prévenir" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "submit");
  });

  it("shows alert and clears email on submit", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const user = userEvent.setup();

    render(<DemoAudioForm />);

    const input = screen.getByPlaceholderText("votre@email.com");
    await user.type(input, "test@example.com");

    expect(input).toHaveValue("test@example.com");

    const button = screen.getByRole("button", { name: "Prévenir" });
    await user.click(button);

    expect(alertSpy).toHaveBeenCalledWith("Merci ! Vous serez prévenu du lancement.");
    expect(input).toHaveValue("");
    alertSpy.mockRestore();
  });

  it("does not submit when email is empty (form is required)", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<DemoAudioForm />);

    const input = screen.getByPlaceholderText("votre@email.com");
    expect(input).toBeRequired();

    alertSpy.mockRestore();
  });

  it("calls alert even when called via fireEvent.submit", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<DemoAudioForm />);

    const input = screen.getByPlaceholderText("votre@email.com");
    fireEvent.change(input, { target: { value: "test@example.com" } });

    const form = input.closest("form")!;
    fireEvent.submit(form);

    expect(alertSpy).toHaveBeenCalledWith("Merci ! Vous serez prévenu du lancement.");
    expect(input).toHaveValue("");

    alertSpy.mockRestore();
  });

  it("renders input with correct placeholder and button styling", () => {
    render(<DemoAudioForm />);

    const input = screen.getByPlaceholderText("votre@email.com");
    expect(input).toHaveClass("w-full");

    const button = screen.getByRole("button", { name: "Prévenir" });
    expect(button).toHaveClass("shrink-0");
  });
});
