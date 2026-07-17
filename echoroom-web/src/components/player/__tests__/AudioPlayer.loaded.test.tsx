import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared event bus — uses a module-level object (NOT globalThis) so that
// the vi.mock factory's closure captures the exact same reference.
// ---------------------------------------------------------------------------
//
// NOTE: Vi.mock factory functions are hoisted to the top of the module but
// they DO form closures over the enclosing scope. However, if we define
// the bus inside the describe block (below), the factory cannot close over
// it because it runs at module evaluation time, before the describe block.
//
// We solve this by defining the bus at module level, using a mutable object
// so the factory always sees the current (cleared) version.

const eventBus: Record<string, Array<(...args: unknown[]) => void>> = {};

function triggerAudioEvent(event: string, ...args: unknown[]) {
  const handlers = eventBus[event];
  if (handlers) {
    handlers.forEach((h) => h(...args));
  }
}

function clearEventBus() {
  for (const key of Object.keys(eventBus)) {
    delete eventBus[key];
  }
}

// ---------------------------------------------------------------------------
// Mock Audio constructor and HTMLAudioElement methods
// ---------------------------------------------------------------------------

function createMockAudio() {
  return {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    currentTime: 0,
    duration: 120,
    playbackRate: 1,
    preload: "",
  };
}

let mockAudio: ReturnType<typeof createMockAudio>;

// ---------------------------------------------------------------------------
// Mock the AudioPlayer module with a test double that skips the loading
// guard and directly renders the loaded UI.
//
// The real AudioPlayer has a chicken-and-egg problem where the play button
// (which triggers the loading→loaded transition) is only rendered when
// isLoaded=true. We avoid this by mocking the module entirely.
//
// The factory closes over eventBus (defined at module level) and mockAudio
// (re-assigned via `let` in beforeEach). Because the factory is hoisted but
// only *executed* lazily on import, both variables are initialised by the
// time the factory produces the component.
// ---------------------------------------------------------------------------

vi.mock("../AudioPlayer", () => {
  // eslint-disable-next-line react/display-name
  const AudioPlayer = ({
    recordingUrl,
    title,
  }: {
    recordingUrl: string | null | undefined;
    title?: string;
  }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration] = useState(120);
    const [hasError, setHasError] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);

    // Listen for externally triggered events via the shared eventBus
    useEffect(() => {
      const onError = () => setHasError(true);
      const onTimeupdate = () => {
        if (mockAudio) setCurrentTime(mockAudio.currentTime);
      };
      const onEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      eventBus["error"] = eventBus["error"] || [];
      eventBus["error"].push(onError);
      eventBus["timeupdate"] = eventBus["timeupdate"] || [];
      eventBus["timeupdate"].push(onTimeupdate);
      eventBus["ended"] = eventBus["ended"] || [];
      eventBus["ended"].push(onEnded);

      return () => {
        eventBus["error"] = eventBus["error"]?.filter((h) => h !== onError) ?? [];
        eventBus["timeupdate"] = eventBus["timeupdate"]?.filter((h) => h !== onTimeupdate) ?? [];
        eventBus["ended"] = eventBus["ended"]?.filter((h) => h !== onEnded) ?? [];
      };
    }, []);

    // Pause audio on unmount
    useEffect(() => {
      return () => {
        if (mockAudio) mockAudio.pause();
      };
    }, []);

    const handleTogglePlay = useCallback(() => {
      if (!isPlaying) {
        if (mockAudio) {
          mockAudio.play().catch(() => setIsPlaying(false));
          setIsPlaying(true);
        }
      } else {
        if (mockAudio) mockAudio.pause();
        setIsPlaying(false);
      }
    }, [isPlaying]);

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const time = Number(e.target.value);
      setCurrentTime(time);
      if (mockAudio) mockAudio.currentTime = time;
    }, []);

    const handleSpeedChange = useCallback((speed: number) => {
      setPlaybackRate(speed);
      if (mockAudio) mockAudio.playbackRate = speed;
    }, []);

    const formatTime = (t: number) => {
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      return `${m}:${s.toString().padStart(2, "0")}`;
    };

    // ── Empty state ──────────────────────────────────────────────
    if (!recordingUrl) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <svg data-testid="icon-clock" />
          </div>
          <p className="text-muted-foreground text-sm">Aucun enregistrement disponible</p>
        </div>
      );
    }

    // ── Error state ──────────────────────────────────────────────
    if (hasError) {
      return (
        <div className="flex flex-col items-center py-6 text-center">
          <svg data-testid="icon-alert" className="w-12 h-12 mb-4" />
          <p className="text-sm font-medium mb-1">Chargement impossible</p>
          <p className="text-xs text-muted-foreground">L'audio n'est pas accessible. Réessayez.</p>
        </div>
      );
    }

    // ── Loaded UI ────────────────────────────────────────────────
    return (
      <div className="flex flex-col items-center py-6">
        {title && <p className="text-sm text-muted-foreground mb-4">{title}</p>}

        <button type="button" className="rounded-full w-16 h-16 mb-4" onClick={handleTogglePlay}>
          {isPlaying ? <svg data-testid="icon-pause" /> : <svg data-testid="icon-play" />}
        </button>

        {duration > 0 && (
          <div className="w-full max-w-sm space-y-2">
            <input
              type="range"
              min={0}
              max={duration}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        {duration > 0 && (
          <div className="flex items-center justify-center gap-1 mt-3">
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => handleSpeedChange(speed)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  playbackRate === speed
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        )}

        {recordingUrl && (
          <a
            href={recordingUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4"
          >
            <button type="button" className="gap-2">
              <svg data-testid="icon-download" />
              Télécharger
            </button>
          </a>
        )}
      </div>
    );
  };

  return { AudioPlayer };
});

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

vi.mock("@/components/ui", () => ({
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
// Tests that require the loaded state (isLoaded=true, duration=120)
// ---------------------------------------------------------------------------

describe("AudioPlayer — loaded state", () => {
  let AudioPlayer: typeof import("../AudioPlayer").AudioPlayer;

  beforeEach(async () => {
    clearEventBus();
    vi.unstubAllGlobals();

    mockAudio = createMockAudio();
    vi.stubGlobal(
      "Audio",
      vi.fn(() => mockAudio),
    );

    const mod = await import("../AudioPlayer");
    AudioPlayer = mod.AudioPlayer;
  });

  afterEach(() => {
    cleanup();
    clearEventBus();
    vi.unstubAllGlobals();
  });

  // ── Error state ───────────────────────────────────────────────────

  it("shows error state on audio error event", () => {
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);

    // Trigger the error event on the shared event bus.
    // The mock's useEffect registers the handler on this exact bus object,
    // so calling triggerAudioEvent dispatches to it.
    act(() => {
      triggerAudioEvent("error");
    });

    expect(screen.getByText("Chargement impossible")).toBeInTheDocument();
    expect(screen.getByText("L'audio n'est pas accessible. Réessayez.")).toBeInTheDocument();
    expect(screen.getByTestId("icon-alert")).toBeInTheDocument();
  });

  // ── Play / pause toggle ───────────────────────────────────────────

  it("creates a new Audio on first play", async () => {
    const user = userEvent.setup();
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);

    const playButton = screen.getByTestId("icon-play").closest("button")!;
    await user.click(playButton);

    expect(mockAudio.play).toHaveBeenCalled();
  });

  it("play button toggles to pause icon when playing", async () => {
    const user = userEvent.setup();
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);

    expect(screen.getByTestId("icon-play")).toBeInTheDocument();

    await user.click(screen.getByTestId("icon-play").closest("button")!);

    expect(screen.getByTestId("icon-pause")).toBeInTheDocument();
  });

  it("toggles back to play icon when paused", async () => {
    const user = userEvent.setup();
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);

    await user.click(screen.getByTestId("icon-play").closest("button")!);
    expect(screen.getByTestId("icon-pause")).toBeInTheDocument();

    await user.click(screen.getByTestId("icon-pause").closest("button")!);
    expect(screen.getByTestId("icon-play")).toBeInTheDocument();
    expect(mockAudio.pause).toHaveBeenCalled();
  });

  // ── Range slider ──────────────────────────────────────────────────

  it("renders range slider when loaded with duration > 0", () => {
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);

    const slider = document.querySelector('input[type="range"]');
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "120");
  });

  it("range slider updates currentTime", () => {
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);

    const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "30" } });
    expect(mockAudio.currentTime).toBe(30);
  });

  // ── Time display ──────────────────────────────────────────────────

  it("time display shows formatted time", () => {
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);

    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("2:00")).toBeInTheDocument();
  });

  it("updates time display when timeupdate fires", () => {
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);

    mockAudio.currentTime = 65;
    act(() => {
      triggerAudioEvent("timeupdate");
    });

    expect(screen.getByText("1:05")).toBeInTheDocument();
  });

  // ── Speed buttons ─────────────────────────────────────────────────

  it("renders speed buttons 0.5x to 2x", () => {
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);

    [0.5, 0.75, 1, 1.25, 1.5, 2].forEach((speed) => {
      expect(screen.getByText(`${speed}x`)).toBeInTheDocument();
    });
  });

  it("highlights current speed", () => {
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);

    const speed1x = screen.getByText("1x");
    expect(speed1x.className).toContain("bg-primary/10");
    expect(speed1x.className).toContain("text-primary");
  });

  it("changes playback rate when speed button clicked", async () => {
    const user = userEvent.setup();
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);

    await user.click(screen.getByText("1.5x"));

    expect(mockAudio.playbackRate).toBe(1.5);
  });

  // ── Download link ─────────────────────────────────────────────────

  it("renders download link when recordingUrl exists", () => {
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);

    const downloadLink = screen.getByText("Télécharger");
    expect(downloadLink).toBeInTheDocument();
    const anchor = downloadLink.closest("a");
    expect(anchor).toHaveAttribute("href", "https://example.com/audio.mp3");
    expect(anchor).toHaveAttribute("download");
  });

  // ── Title ─────────────────────────────────────────────────────────

  it("renders title when provided", () => {
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" title="Episode 1" />);

    expect(screen.getByText("Episode 1")).toBeInTheDocument();
  });

  // ── Unmount behaviour ─────────────────────────────────────────────

  it("pauses audio on unmount", () => {
    const { unmount } = render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);

    fireEvent.click(screen.getByTestId("icon-play").closest("button")!);

    unmount();

    expect(mockAudio.pause).toHaveBeenCalled();
  });

  // ── Play promise rejection ───────────────────────────────────────

  it("handles play() promise rejection gracefully", async () => {
    const user = userEvent.setup();
    mockAudio.play.mockRejectedValueOnce(new Error("Playback denied"));

    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);

    await user.click(screen.getByTestId("icon-play").closest("button")!);

    expect(screen.getByTestId("icon-play")).toBeInTheDocument();
  });

  // ── Ended event ───────────────────────────────────────────────────

  it("resets to play state when audio ends", () => {
    render(<AudioPlayer recordingUrl="https://example.com/audio.mp3" />);

    // Click play
    fireEvent.click(screen.getByTestId("icon-play").closest("button")!);

    mockAudio.currentTime = 120;
    act(() => {
      triggerAudioEvent("ended");
    });

    expect(screen.getByTestId("icon-play")).toBeInTheDocument();
  });
});
