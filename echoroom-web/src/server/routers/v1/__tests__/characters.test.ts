import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// charactersV1Router tests
// ---------------------------------------------------------------------------
// Tests the v1 characters router: list (with category filter + caching)
// and getBySlug (single character lookup).

const mockDb = vi.hoisted(() => ({
  character: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

const mockGetCachedCharacters = vi.hoisted(() => vi.fn());
const mockSetCachedCharacters = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/cache/characterCache", () => ({
  getCachedCharacters: mockGetCachedCharacters,
  setCachedCharacters: mockSetCachedCharacters,
}));

vi.mock("@/lib/redis", () => ({
  redis: null,
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock procedures module (v1 routers import from "../../procedures")
vi.mock("@/server/procedures", () => {
  const chain = {
    input: vi.fn(() => chain),
    mutation: vi.fn((handler: Function) => ({
      type: "mutation" as const,
      handler,
    })),
    query: vi.fn((handler: Function) => ({
      type: "query" as const,
      handler,
    })),
    use: vi.fn(() => chain),
  };

  return {
    router: vi.fn((routes: Record<string, unknown>) => routes),
    t: { procedure: chain },
    publicProcedure: chain,
    protectedProcedure: chain,
    adminProcedure: chain,
    middleware: vi.fn((fn: Function) => fn),
    withRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
    withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
  };
});

const MOCK_CHARACTERS = [
  {
    id: "char-1",
    name: "Aria",
    slug: "aria",
    description: "A romantic character",
    previewAudioUrl: "https://example.com/audio/aria.mp3",
    avatarUrl: "https://example.com/avatars/aria.png",
    category: "ROMANTIC",
    isFeatured: true,
  },
  {
    id: "char-2",
    name: "Zara",
    slug: "zara",
    description: "A chaotic character",
    previewAudioUrl: null,
    avatarUrl: null,
    category: "CHAOTIC",
    isFeatured: false,
  },
];

// ---------------------------------------------------------------------------
// list — public character listing with optional category filter
// ---------------------------------------------------------------------------
describe("charactersV1Router.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return all characters when no category filter", async () => {
    mockGetCachedCharacters.mockResolvedValue(null);
    mockDb.character.findMany.mockResolvedValue(MOCK_CHARACTERS);

    const { charactersV1Router } = await import("../characters");
    const handler = (charactersV1Router as any).list.handler;

    const result = await handler({ input: {}, ctx: {} });

    expect(result).toEqual(MOCK_CHARACTERS);
    expect(mockDb.character.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        previewAudioUrl: true,
        avatarUrl: true,
        category: true,
        isFeatured: true,
      },
    });
  });

  it("should filter by category when provided", async () => {
    mockGetCachedCharacters.mockResolvedValue(null);
    mockDb.character.findMany.mockResolvedValue([MOCK_CHARACTERS[0]!]);

    const { charactersV1Router } = await import("../characters");
    const handler = (charactersV1Router as any).list.handler;

    const result = await handler({ input: { category: "ROMANTIC" }, ctx: {} });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Aria");
    expect(mockDb.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { category: "ROMANTIC" },
      }),
    );
  });

  it("should return cached characters when cache is hit", async () => {
    const cached = [MOCK_CHARACTERS[0]!];
    mockGetCachedCharacters.mockResolvedValue(cached);

    const { charactersV1Router } = await import("../characters");
    const handler = (charactersV1Router as any).list.handler;

    const result = await handler({ input: {}, ctx: {} });

    expect(result).toEqual(cached);
    expect(mockDb.character.findMany).not.toHaveBeenCalled();
  });

  it("should cache characters after DB query", async () => {
    mockGetCachedCharacters.mockResolvedValue(null);
    mockDb.character.findMany.mockResolvedValue(MOCK_CHARACTERS);

    const { charactersV1Router } = await import("../characters");
    const handler = (charactersV1Router as any).list.handler;

    await handler({ input: {}, ctx: {} });

    expect(mockSetCachedCharacters).toHaveBeenCalledWith(
      MOCK_CHARACTERS,
      {},
    );
  });

  it("should cache characters with category param after DB query", async () => {
    mockGetCachedCharacters.mockResolvedValue(null);
    mockDb.character.findMany.mockResolvedValue([MOCK_CHARACTERS[0]!]);

    const { charactersV1Router } = await import("../characters");
    const handler = (charactersV1Router as any).list.handler;

    await handler({ input: { category: "ROMANTIC" }, ctx: {} });

    expect(mockSetCachedCharacters).toHaveBeenCalledWith(
      [MOCK_CHARACTERS[0]!],
      { category: "ROMANTIC" },
    );
  });

  it("should not cache characters when cache read returns data", async () => {
    const cached = MOCK_CHARACTERS;
    mockGetCachedCharacters.mockResolvedValue(cached);

    const { charactersV1Router } = await import("../characters");
    const handler = (charactersV1Router as any).list.handler;

    await handler({ input: {}, ctx: {} });

    expect(mockSetCachedCharacters).not.toHaveBeenCalled();
  });

  it("should return empty array when no characters match filter", async () => {
    mockGetCachedCharacters.mockResolvedValue(null);
    mockDb.character.findMany.mockResolvedValue([]);

    const { charactersV1Router } = await import("../characters");
    const handler = (charactersV1Router as any).list.handler;

    const result = await handler({ input: { category: "HORROR" }, ctx: {} });

    expect(result).toEqual([]);
  });

  it("should handle optional input being undefined", async () => {
    mockGetCachedCharacters.mockResolvedValue(null);
    mockDb.character.findMany.mockResolvedValue(MOCK_CHARACTERS);

    const { charactersV1Router } = await import("../characters");
    const handler = (charactersV1Router as any).list.handler;

    // When no input is provided at all (the Zod input is optional)
    const result = await handler({ input: undefined, ctx: {} });

    expect(result).toEqual(MOCK_CHARACTERS);
    expect(mockDb.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});

// ---------------------------------------------------------------------------
// getBySlug — single character lookup
// ---------------------------------------------------------------------------
describe("charactersV1Router.getBySlug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return a character when slug exists", async () => {
    mockDb.character.findUnique.mockResolvedValue(MOCK_CHARACTERS[0]!);

    const { charactersV1Router } = await import("../characters");
    const handler = (charactersV1Router as any).getBySlug.handler;

    const result = await handler({ input: { slug: "aria" }, ctx: {} });

    expect(result).toEqual(MOCK_CHARACTERS[0]!);
    expect(mockDb.character.findUnique).toHaveBeenCalledWith({
      where: { slug: "aria" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        previewAudioUrl: true,
        avatarUrl: true,
        category: true,
        isFeatured: true,
      },
    });
  });

  it("should return null when slug does not exist", async () => {
    mockDb.character.findUnique.mockResolvedValue(null);

    const { charactersV1Router } = await import("../characters");
    const handler = (charactersV1Router as any).getBySlug.handler;

    const result = await handler({ input: { slug: "nonexistent" }, ctx: {} });

    expect(result).toBeNull();
  });
});
