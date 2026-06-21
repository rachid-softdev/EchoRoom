import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

// ─────────────────────────────────────────────────────────────
// Hoisted mocks (must be before vi.mock calls)
// ─────────────────────────────────────────────────────────────
const mockFindUnique = vi.hoisted(() => vi.fn());
const mockNotFound = vi.hoisted(
  () => vi.fn(() => { throw new Error("NOT_FOUND"); }),
);

// ─────────────────────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────────────────────

vi.mock("@/server/db", () => ({
  db: {
    user: {
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("lucide-react", () => ({
  Calendar: () => <svg data-testid="icon-calendar" />,
  FileAudio: () => <svg data-testid="icon-file-audio" />,
  Users: () => <svg data-testid="icon-users" />,
  Phone: () => <svg data-testid="icon-phone" />,
  Sparkles: () => <svg data-testid="icon-sparkles" />,
  ArrowRight: () => <svg data-testid="icon-arrow-right" />,
}));

vi.mock("@/components/shared/DashboardShell", () => ({
  DashboardShell: ({ children, title, subtitle }: any) => (
    <div data-testid="dashboard-shell" data-title={title}>
      {subtitle && <p data-testid="shell-subtitle">{subtitle}</p>}
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui", () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  ),
  CardContent: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  ),
  CardHeader: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  ),
  CardTitle: ({ children, className, ...props }: any) => (
    <h3 className={className} {...props}>{children}</h3>
  ),
  CardDescription: ({ children, className, ...props }: any) => (
    <p className={className} {...props}>{children}</p>
  ),
  Badge: ({ children, variant, className, ...props }: any) => (
    <span data-variant={variant} className={className} {...props}>
      {children}
    </span>
  ),
}));

// ─────────────────────────────────────────────────────────────
// Imports — MUST come after all vi.mock calls
// ─────────────────────────────────────────────────────────────
import ProfilePage, {
  generateMetadata,
  formatRelativeDate,
  buildActivityFeed,
} from "../page";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Creates a minimal user object with sensible defaults. */
function createUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u-1",
    username: "testuser",
    createdAt: new Date("2026-01-15T10:00:00Z"),
    _count: { scenarios: 2, calls: 3 },
    scenarios: [
      {
        id: "s-1",
        title: "Speed Dating",
        createdAt: new Date("2026-06-20T10:00:00Z"),
        playCount: 42,
        likeCount: 7,
      },
      {
        id: "s-2",
        title: "Job Interview",
        createdAt: new Date("2026-06-18T10:00:00Z"),
        playCount: 15,
        likeCount: 2,
      },
    ],
    calls: [
      {
        id: "c-1",
        createdAt: new Date("2026-06-19T10:00:00Z"),
        status: "COMPLETED",
        durationSeconds: 120,
        scenario: { id: "s-1", title: "Speed Dating" },
      },
      {
        id: "c-2",
        createdAt: new Date("2026-06-17T10:00:00Z"),
        status: "FAILED",
        durationSeconds: 30,
        scenario: null,
      },
    ],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// formatRelativeDate — pure function unit tests
// ─────────────────────────────────────────────────────────────
describe("formatRelativeDate", () => {
  const NOW = new Date("2026-06-21T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'À l'instant' for dates less than 1 minute ago", () => {
    expect(formatRelativeDate(new Date(NOW.getTime() - 30_000))).toBe(
      "À l'instant",
    );
  });

  it("returns minute format for dates < 1 hour", () => {
    expect(formatRelativeDate(new Date(NOW.getTime() - 5 * 60_000))).toBe(
      "Il y a 5 min",
    );
  });

  it("returns 'Il y a 1 min' for exactly 1 minute ago", () => {
    expect(formatRelativeDate(new Date(NOW.getTime() - 60_000))).toBe(
      "Il y a 1 min",
    );
  });

  it("returns hour format for dates < 24 hours", () => {
    expect(formatRelativeDate(new Date(NOW.getTime() - 3 * 3_600_000))).toBe(
      "Il y a 3h",
    );
  });

  it("returns 'Il y a 1h' for exactly 1 hour ago", () => {
    expect(formatRelativeDate(new Date(NOW.getTime() - 3_600_000))).toBe(
      "Il y a 1h",
    );
  });

  it("returns day format for dates < 7 days", () => {
    expect(formatRelativeDate(new Date(NOW.getTime() - 5 * 86_400_000))).toBe(
      "Il y a 5j",
    );
  });

  it("returns 'Il y a 1j' for exactly 1 day ago", () => {
    expect(formatRelativeDate(new Date(NOW.getTime() - 86_400_000))).toBe(
      "Il y a 1j",
    );
  });

  it("returns formatted short date for dates >= 7 days", () => {
    // 14 days before the fixed NOW (2026-06-21)
    const date = new Date("2026-06-07T12:00:00.000Z");
    expect(formatRelativeDate(date)).toBe("7 juin");
  });

  it("handles dates in different months", () => {
    // 37 days before the fixed NOW (crosses month boundary)
    const date = new Date("2026-05-15T12:00:00.000Z");
    expect(formatRelativeDate(date)).toBe("15 mai");
  });

  it("handles dates at year boundary", () => {
    // Well over 7 days, in previous year
    const date = new Date("2025-12-25T12:00:00.000Z");
    expect(formatRelativeDate(date)).toBe("25 déc.");
  });

  it("returns 'À l'instant' for future dates (negative diff)", () => {
    // A date 10 seconds in the future
    expect(formatRelativeDate(new Date(NOW.getTime() + 10_000))).toBe(
      "À l'instant",
    );
  });

  it("handles exactly 0ms difference", () => {
    expect(formatRelativeDate(NOW)).toBe("À l'instant");
  });

  it("uses French locale for formatted dates", () => {
    // 14 days before the fixed NOW (≥7 days, so it uses full format)
    const date = new Date("2026-06-07T12:00:00.000Z");
    const result = formatRelativeDate(date);
    expect(result).toBe("7 juin");
  });
});

// ─────────────────────────────────────────────────────────────
// buildActivityFeed — pure function unit tests
// ─────────────────────────────────────────────────────────────
describe("buildActivityFeed", () => {
  it("returns an empty array when both inputs are empty", () => {
    expect(buildActivityFeed([], [])).toEqual([]);
  });

  it("combines scenarios and calls into a single array", () => {
    const scenarios = [
      { id: "s-1", title: "S1", createdAt: new Date("2026-01-01"), playCount: 0, likeCount: 0 },
    ];
    const calls = [
      { id: "c-1", createdAt: new Date("2026-01-02"), status: "COMPLETED", durationSeconds: 60 },
    ];

    const result = buildActivityFeed(scenarios, calls);
    expect(result).toHaveLength(2);
  });

  it("sorts items by createdAt descending (most recent first)", () => {
    const scenarios = [
      { id: "s-old", title: "Old", createdAt: new Date("2026-01-01"), playCount: 0, likeCount: 0 },
      { id: "s-new", title: "New", createdAt: new Date("2026-06-01"), playCount: 0, likeCount: 0 },
    ];
    const calls = [
      { id: "c-mid", createdAt: new Date("2026-03-15"), status: "COMPLETED", durationSeconds: 60 },
    ];

    const result = buildActivityFeed(scenarios, calls);

    expect(result[0].id).toBe("s-new"); // June
    expect(result[1].id).toBe("c-mid"); // March
    expect(result[2].id).toBe("s-old"); // January
  });

  it("limits the result to ACTIVITY_LIMIT (10) items", () => {
    const scenarios = Array.from({ length: 8 }, (_, i) => ({
      id: `s-${i}`,
      title: `S${i}`,
      createdAt: new Date(`2026-06-${20 - i}T10:00:00Z`),
      playCount: 0,
      likeCount: 0,
    }));
    const calls = Array.from({ length: 5 }, (_, i) => ({
      id: `c-${i}`,
      createdAt: new Date(`2026-06-${15 - i}T10:00:00Z`),
      status: "COMPLETED" as string,
      durationSeconds: 60,
    }));

    const result = buildActivityFeed(scenarios, calls);
    expect(result).toHaveLength(10);
  });

  it("does not slice when total < ACTIVITY_LIMIT", () => {
    const scenarios = Array.from({ length: 3 }, (_, i) => ({
      id: `s-${i}`,
      title: `S${i}`,
      createdAt: new Date(`2026-06-${20 - i}T10:00:00Z`),
      playCount: 0,
      likeCount: 0,
    }));

    const result = buildActivityFeed(scenarios, []);
    expect(result).toHaveLength(3);
  });

  it("sets type='scenario' on scenario items", () => {
    const scenarios = [
      { id: "s-1", title: "Test", createdAt: new Date(), playCount: 5, likeCount: 2 },
    ];
    const [item] = buildActivityFeed(scenarios, []);

    expect(item.type).toBe("scenario");
    expect(item).toHaveProperty("id", "s-1");
    expect(item).toHaveProperty("title", "Test");
    expect(item).toHaveProperty("playCount", 5);
    expect(item).toHaveProperty("likeCount", 2);
  });

  it("sets type='call' on call items and preserves call fields", () => {
    const calls = [
      { id: "c-1", createdAt: new Date(), status: "COMPLETED", durationSeconds: 90 },
    ];
    const [item] = buildActivityFeed([], calls);

    expect(item.type).toBe("call");
    expect(item).toHaveProperty("id", "c-1");
    expect(item).toHaveProperty("status", "COMPLETED");
    expect(item).toHaveProperty("durationSeconds", 90);
  });

  it("works when only scenarios present", () => {
    const scenarios = [
      { id: "s-1", title: "Only", createdAt: new Date("2026-06-01"), playCount: 0, likeCount: 0 },
    ];
    expect(buildActivityFeed(scenarios, [])).toHaveLength(1);
  });

  it("works when only calls present", () => {
    const calls = [
      { id: "c-1", createdAt: new Date("2026-06-01"), status: "ACTIVE", durationSeconds: 0 },
    ];
    expect(buildActivityFeed([], calls)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────
// generateMetadata
// ─────────────────────────────────────────────────────────────
describe("generateMetadata", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns not-found metadata when user does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: { username: "unknown" },
    });

    expect(metadata).toEqual({
      title: "Profil introuvable — EchoRoom AI",
      description: "Ce profil n'existe pas sur EchoRoom AI.",
    });
  });

  it("queries with the correct username", async () => {
    mockFindUnique.mockResolvedValue({ username: "janedoe" });

    await generateMetadata({ params: { username: "janedoe" } });

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { username: "janedoe" },
      select: { username: true },
    });
  });

  it("returns profile metadata with OpenGraph and Twitter tags", async () => {
    mockFindUnique.mockResolvedValue({ username: "janedoe" });

    const metadata = await generateMetadata({
      params: { username: "janedoe" },
    });

    expect(metadata.title).toBe("janedoe — EchoRoom AI");
    expect(metadata.description).toContain("Découvrez le profil de janedoe");

    // OpenGraph
    expect(metadata.openGraph).toEqual(
      expect.objectContaining({
        title: "janedoe — EchoRoom AI",
        description: expect.stringContaining("janedoe"),
        siteName: "EchoRoom AI",
        type: "profile",
        username: "janedoe",
      }),
    );

    // Twitter
    expect(metadata.twitter).toEqual({
      card: "summary_large_image",
      title: "janedoe — EchoRoom AI",
      description: expect.stringContaining("janedoe"),
    });
  });

  it("does not set openGraph or twitter when user is not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: { username: "ghost" },
    });

    expect(metadata.openGraph).toBeUndefined();
    expect(metadata.twitter).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// ProfilePage — rendering
// ─────────────────────────────────────────────────────────────
describe("ProfilePage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ── Not found ────────────────────────────────────────

  describe("user not found", () => {
    it("calls notFound() and does not render when db returns null", async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(
        ProfilePage({ params: { username: "nonexistent" } }),
      ).rejects.toThrow("NOT_FOUND");

      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it("calls findUnique with the correct username", async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(
        ProfilePage({ params: { username: "ghost" } }),
      ).rejects.toThrow("NOT_FOUND");

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { username: "ghost" },
        select: expect.any(Object),
      });
    });
  });

  // ── Empty activity ───────────────────────────────────

  describe("empty activity", () => {
    it("shows 'Pas encore d'activité' when user has no scenarios or calls", async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          _count: { scenarios: 0, calls: 0 },
          scenarios: [],
          calls: [],
        }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      expect(screen.getByText("Pas encore d'activité")).toBeInTheDocument();
    });

    it("shows the username in the empty state message", async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          _count: { scenarios: 0, calls: 0 },
          scenarios: [],
          calls: [],
          username: "bob",
        }),
      );

      const page = await ProfilePage({ params: { username: "bob" } });
      render(page);

      expect(
        screen.getByText(/bob n'a pas encore créé/),
      ).toBeInTheDocument();
    });

    it("displays stats as 0 for empty activity", async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          _count: { scenarios: 0, calls: 0 },
          scenarios: [],
          calls: [],
        }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      const zeroElements = screen.getAllByText("0");
      expect(zeroElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Profile header ───────────────────────────────────

  describe("profile header", () => {
    it("renders DashboardShell with username as title", async () => {
      mockFindUnique.mockResolvedValue(createUser());

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      expect(screen.getByTestId("dashboard-shell")).toHaveAttribute(
        "data-title",
        "testuser",
      );
      expect(screen.getByTestId("shell-subtitle")).toHaveTextContent(
        "Profil public",
      );
    });

    it("displays user initials (first 2 chars uppercased)", async () => {
      mockFindUnique.mockResolvedValue(createUser({ username: "alice" }));

      const page = await ProfilePage({ params: { username: "alice" } });
      render(page);

      expect(screen.getByText("AL")).toBeInTheDocument();
    });

    it("handles 1-char usernames for initials", async () => {
      mockFindUnique.mockResolvedValue(createUser({ username: "a" }));

      const page = await ProfilePage({ params: { username: "a" } });
      render(page);

      expect(screen.getByText("A")).toBeInTheDocument();
    });

    it("shows 'Member since' with French formatted date", async () => {
      mockFindUnique.mockResolvedValue(
        createUser({ createdAt: new Date("2026-01-15T10:00:00Z") }),
        // "janvier 2026" in French
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      expect(screen.getByText(/Membre depuis/)).toBeInTheDocument();
      expect(screen.getByText(/janvier 2026/)).toBeInTheDocument();
    });
  });

  // ── Stats counters ───────────────────────────────────

  describe("stats counters", () => {
    it("displays scenarios count and calls count", async () => {
      mockFindUnique.mockResolvedValue(
        createUser({ _count: { scenarios: 7, calls: 3 } }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("Scénarios créés")).toBeInTheDocument();
      expect(screen.getByText("Appels effectués")).toBeInTheDocument();
    });

    it("renders both stat cards with icons", async () => {
      mockFindUnique.mockResolvedValue(
        createUser({ _count: { scenarios: 1, calls: 2 } }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      // FileAudio appears in stat card + each scenario feed item (scenarios mock has 2)
      const fileAudioIcons = screen.getAllByTestId("icon-file-audio");
      expect(fileAudioIcons.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByTestId("icon-users")).toBeInTheDocument();
    });
  });

  // ── Activity feed with items ─────────────────────────

  describe("activity feed rendering", () => {
    it("renders scenario items with title, play count, and like count", async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          scenarios: [
            {
              id: "s-1",
              title: "Chaos Call",
              createdAt: new Date("2026-06-20T10:00:00Z"),
              playCount: 99,
              likeCount: 12,
            },
          ],
          calls: [],
        }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      expect(screen.getByText("Chaos Call")).toBeInTheDocument();
      expect(screen.getByText("Nouveau scénario")).toBeInTheDocument();
      expect(screen.getByText(/99 lectures/)).toBeInTheDocument();
      expect(screen.getByText(/12 likes/)).toBeInTheDocument();
    });

    it("renders call items with scenario title, status badge, and duration", async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          scenarios: [],
          calls: [
            {
              id: "c-1",
              createdAt: new Date("2026-06-20T10:00:00Z"),
              status: "COMPLETED",
              durationSeconds: 180,
              scenario: { id: "s-1", title: "Speed Dating" },
            },
          ],
        }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      expect(screen.getByText("Speed Dating")).toBeInTheDocument();
      expect(screen.getByText("Terminé")).toBeInTheDocument();
      expect(screen.getByText("180s")).toBeInTheDocument();
    });

    it("uses 'Appel' as fallback title when call has no scenario", async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          scenarios: [],
          calls: [
            {
              id: "c-1",
              createdAt: new Date("2026-06-20T10:00:00Z"),
              status: "COMPLETED",
              durationSeconds: 45,
              scenario: null,
            },
          ],
        }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      expect(screen.getByText("Appel")).toBeInTheDocument();
    });

    it("hides duration display for calls with 0 duration", async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          scenarios: [],
          calls: [
            {
              id: "c-1",
              createdAt: new Date("2026-06-20T10:00:00Z"),
              status: "COMPLETED",
              durationSeconds: 0,
              scenario: null,
            },
          ],
        }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      expect(screen.queryByText("0s")).not.toBeInTheDocument();
    });

    it("links scenarios to /scenario/{id} and calls to /call/{id}", async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          scenarios: [
            {
              id: "s-abc",
              title: "My Scenario",
              createdAt: new Date("2026-06-20T10:00:00Z"),
              playCount: 1,
              likeCount: 0,
            },
          ],
          calls: [
            {
              id: "c-xyz",
              createdAt: new Date("2026-06-19T10:00:00Z"),
              status: "COMPLETED",
              durationSeconds: 60,
              scenario: null,
            },
          ],
        }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      const scenarioLink = screen.getByRole("link", { name: /My Scenario/ });
      expect(scenarioLink).toHaveAttribute("href", "/scenario/s-abc");

      const callLink = screen.getByRole("link", { name: /Appel/ });
      expect(callLink).toHaveAttribute("href", "/call/c-xyz");
    });
  });

  // ── Activity sorting & limiting ──────────────────────

  describe("activity feed sorting and limiting", () => {
    it("displays items in descending chronological order", async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          scenarios: [
            {
              id: "s-old",
              title: "Old Scenario",
              createdAt: new Date("2026-06-01T10:00:00Z"),
              playCount: 1,
              likeCount: 0,
            },
            {
              id: "s-new",
              title: "New Scenario",
              createdAt: new Date("2026-06-20T10:00:00Z"),
              playCount: 5,
              likeCount: 2,
            },
          ],
          calls: [],
        }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      const links = screen.getAllByRole("link");
      const hrefs = links.map((l) => l.getAttribute("href"));
      const newIdx = hrefs.indexOf("/scenario/s-new");
      const oldIdx = hrefs.indexOf("/scenario/s-old");

      expect(newIdx).toBeGreaterThanOrEqual(0);
      expect(oldIdx).toBeGreaterThanOrEqual(0);
      expect(newIdx).toBeLessThan(oldIdx);
    });

    it("shows '(10 les plus récents)' suffix when total items exceed 10", async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          _count: { scenarios: 8, calls: 7 }, // total = 15 > 10
          scenarios: Array.from({ length: 8 }, (_, i) => ({
            id: `s-${i}`,
            title: `Scenario ${i}`,
            createdAt: new Date(`2026-06-${20 - i}T10:00:00Z`),
            playCount: 0,
            likeCount: 0,
          })),
          calls: Array.from({ length: 7 }, (_, i) => ({
            id: `c-${i}`,
            createdAt: new Date(`2026-06-${15 - i}T10:00:00Z`),
            status: "COMPLETED",
            durationSeconds: 60,
            scenario: null,
          })),
        }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      expect(screen.getByText(/10 les plus récents/)).toBeInTheDocument();
    });

    it("hides limit suffix when total items <= 10", async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          _count: { scenarios: 2, calls: 3 }, // total = 5 <= 10
        }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      expect(
        screen.queryByText(/les plus récents/),
      ).not.toBeInTheDocument();
    });

    it("limits feed to 10 items when there are more", async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          scenarios: Array.from({ length: 8 }, (_, i) => ({
            id: `s-${i}`,
            title: `Scenario ${i}`,
            createdAt: new Date(`2026-06-${20 - i}T10:00:00Z`),
            playCount: 0,
            likeCount: 0,
          })),
          calls: Array.from({ length: 7 }, (_, i) => ({
            id: `c-${i}`,
            createdAt: new Date(`2026-06-${15 - i}T10:00:00Z`),
            status: "COMPLETED",
            durationSeconds: 60,
            scenario: null,
          })),
        }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      // Count feed items — each has a link to either /scenario/ or /call/
      const feedLinks = screen
        .getAllByRole("link")
        .filter(
          (l) =>
            l.getAttribute("href")?.startsWith("/scenario/") ||
            l.getAttribute("href")?.startsWith("/call/"),
        );
      expect(feedLinks.length).toBeLessThanOrEqual(10);
    });
  });

  // ── Status badge variants ────────────────────────────

  describe("status badges", () => {
    it('shows "Terminé" badge with variant "secondary" for COMPLETED calls', async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          scenarios: [],
          calls: [
            {
              id: "c-1",
              createdAt: new Date("2026-06-20T10:00:00Z"),
              status: "COMPLETED",
              durationSeconds: 60,
              scenario: null,
            },
          ],
        }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      const badge = screen.getByText("Terminé");
      expect(badge).toBeInTheDocument();
      expect(badge.closest("span")).toHaveAttribute(
        "data-variant",
        "secondary",
      );
    });

    it('shows "Échoué" badge with variant "destructive" for FAILED calls', async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          scenarios: [],
          calls: [
            {
              id: "c-1",
              createdAt: new Date("2026-06-20T10:00:00Z"),
              status: "FAILED",
              durationSeconds: 30,
              scenario: null,
            },
          ],
        }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      const badge = screen.getByText("Échoué");
      expect(badge).toBeInTheDocument();
      expect(badge.closest("span")).toHaveAttribute(
        "data-variant",
        "destructive",
      );
    });

    it('shows raw status with variant "outline" for unknown statuses', async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          scenarios: [],
          calls: [
            {
              id: "c-1",
              createdAt: new Date("2026-06-20T10:00:00Z"),
              status: "PENDING",
              durationSeconds: 0,
              scenario: null,
            },
          ],
        }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      const badge = screen.getByText("PENDING");
      expect(badge).toBeInTheDocument();
      expect(badge.closest("span")).toHaveAttribute(
        "data-variant",
        "outline",
      );
    });

    it('uses variant "outline" for ACTIVE status', async () => {
      mockFindUnique.mockResolvedValue(
        createUser({
          scenarios: [],
          calls: [
            {
              id: "c-1",
              createdAt: new Date("2026-06-20T10:00:00Z"),
              status: "ACTIVE",
              durationSeconds: 0,
              scenario: null,
            },
          ],
        }),
      );

      const page = await ProfilePage({ params: { username: "testuser" } });
      render(page);

      const badge = screen.getByText("ACTIVE");
      expect(badge).toBeInTheDocument();
      expect(badge.closest("span")).toHaveAttribute(
        "data-variant",
        "outline",
      );
    });
  });
});
