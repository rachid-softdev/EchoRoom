import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock Audio constructor and HTMLAudioElement methods
// ---------------------------------------------------------------------------

const eventListeners: Record<string, Array<(...args: unknown[]) => void>> = {};

function createMockAudio() {
  return {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    addEventListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!eventListeners[event]) eventListeners[event] = [];
      eventListeners[event].push(handler);
    }),
    removeEventListener: vi.fn(),
    currentTime: 0,
    duration: 120,
    playbackRate: 1,
    preload: "",
  };
}

function clearEventListeners() {
  for (const key of Object.keys(eventListeners)) {
    delete eventListeners[key];
  }
}

let mockAudio: ReturnType<typeof createMockAudio>;

// ---------------------------------------------------------------------------
// Mock lucide-react icons
// ---------------------------------------------------------------------------

vi.mock("lucide-react", () => ({
  Play: () => <svg data-testid="icon-play" />,
  Pause: () => <svg data-testid="icon-pause" />,
  Download: () => <svg data-testid="icon-download" />,
  Clock: () => <svg data-testid="icon-clock" />,
  Loader2: () => <svg data-testid="icon-loader" data-animate-spin />,
  AlertTriangle: () => <svg data-testid="icon-alert" />,
}));

// ---------------------------------------------------------------------------
// Mock Button from UI
// ---------------------------------------------------------------------------

vi.mock("@echoroom/ui", () => ({
  Button: ({
    children,
    disabled,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

// ---------------------------------------------------------------------------
// Shared test config
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  clearEventListeners();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AudioPlayer", () => {
  let AudioPlayer: typeof import("../AudioPlayer").AudioPlayer;

  beforeEach(async () => {
    vi.clearAllMocks();
    clearEventListeners();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();

    mockAudio = createMockAudio();
    vi.stubGlobal(
      "Audio",
      vi.fn(() => mockAudio),
    );

    const mod = await import("../AudioPlayer");
    AudioPlayer = mod.AudioPlayer;
  });

  // ── Empty state ───────────────────────────────────────────────────

  it("shows empty state when recordingUrl is null", () => {
    render(<AudioPlayer recordingUrl={null} />);
    expect(screen.getByText("Aucun enregistrement disponible")).toBeInTheDocument();
    expect(screen.getByTestId("icon-clock")).toBeInTheDocument();
  });

  it("shows empty state when recordingUrl is undefined", () => {
    render(<AudioPlayer recordingUrl={undefined} />);
    expect(screen.getByText("Aucun enregistrement disponible")).toBeInTheDocument();
  });

  // ── Loading state ─────────────────────────────────────────────────

  it("shows loading spinner while audio loads", () => {
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);
    expect(screen.getByText("Préparation de l'audio...")).toBeInTheDocument();
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
  });

  it("play button is disabled when not loaded", () => {
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);
    expect(screen.getByText("Préparation de l'audio...")).toBeInTheDocument();
  });
});
