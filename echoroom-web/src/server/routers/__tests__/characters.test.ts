import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// charactersRouter tests — list, getBySlug
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  character: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

// Mock character cache service
const mockCharacterCache = vi.hoisted(() => ({
  getCachedCharacters: vi.fn(),
  setCachedCharacters: vi.fn(),
}));

vi.mock("@/server/services/cache/characterCache", () => mockCharacterCache);

// Mock tRPC
vi.mock("@/server/trpc", () => {
  const chain = {
    input: vi.fn(() => chain),
    mutation: vi.fn(() => ({
      type: "mutation" as const,
    })),
    query: vi.fn((handler: Function) => ({
      type: "query" as const,
      handler,
    })),
    use: vi.fn(() => chain),
  };

  return {
    t: { procedure: chain },
    router: vi.fn((routes: Record<string, unknown>) => routes),
    publicProcedure: chain,
    protectedProcedure: chain,
    adminProcedure: chain,
    middleware: vi.fn((fn: Function) => fn),
    withRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withIPRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
  };
});

type ListInput = { input?: { category?: string } };
type ListHandler = (opts: ListInput) => Promise<unknown[]>;

type GetBySlugInput = { input: { slug: string } };
type GetBySlugHandler = (opts: GetBySlugInput) => Promise<unknown>;

const MOCK_CHARACTERS = [
  {
    id: "char-1",
    name: "Alice",
    slug: "alice",
    description: "A friendly character",
    previewAudioUrl: null,
    avatarUrl: null,
    category: "ROMANTIC",
    isFeatured: true,
  },
  {
    id: "char-2",
    name: "Bob",
    slug: "bob",
    description: "A chaotic character",
    previewAudioUrl: null,
    avatarUrl: null,
    category: "CHAOTIC",
    isFeatured: false,
  },
  {
    id: "char-3",
    name: "Charlie",
    slug: "charlie",
    description: "Corporate type",
    previewAudioUrl: null,
    avatarUrl: null,
    category: "CORPORATE",
    isFeatured: false,
  },
];

describe("charactersRouter.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return all characters when no filter is provided (cache miss)", async () => {
    mockCharacterCache.getCachedCharacters.mockResolvedValue(null);
    mockDb.character.findMany.mockResolvedValue(MOCK_CHARACTERS);

    const { charactersRouter } = await import("../characters");
    // @ts-expect-error — query handler is captured at module import time
    const handler: ListHandler = charactersRouter.list.handler;

    const result = await handler({ input: {} });

    expect(result).toEqual(MOCK_CHARACTERS);
    expect(mockCharacterCache.getCachedCharacters).toHaveBeenCalledWith({});
    expect(mockDb.character.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
      select: expect.objectContaining({
        id: true,
        name: true,
        slug: true,
      }),
    });
    expect(mockCharacterCache.setCachedCharacters).toHaveBeenCalledWith(MOCK_CHARACTERS, {});
  });

  it("should return cached characters on cache hit", async () => {
    const cachedCharacters = MOCK_CHARACTERS.slice(0, 1);
    mockCharacterCache.getCachedCharacters.mockResolvedValue(cachedCharacters);

    const { charactersRouter } = await import("../characters");
    // @ts-expect-error — query handler is captured at module import time
    const handler: ListHandler = charactersRouter.list.handler;

    const result = await handler({ input: {} });

    expect(result).toEqual(cachedCharacters);
    expect(mockDb.character.findMany).not.toHaveBeenCalled();
    expect(mockCharacterCache.setCachedCharacters).not.toHaveBeenCalled();
  });

  it("should filter by category when category is provided", async () => {
    mockCharacterCache.getCachedCharacters.mockResolvedValue(null);
    const romanticCharacters = MOCK_CHARACTERS.filter((c) => c.category === "ROMANTIC");
    mockDb.character.findMany.mockResolvedValue(romanticCharacters);

    const { charactersRouter } = await import("../characters");
    // @ts-expect-error — query handler is captured at module import time
    const handler: ListHandler = charactersRouter.list.handler;

    const result = await handler({ input: { category: "ROMANTIC" } });

    expect(result).toHaveLength(1);
    expect((result[0] as any)?.name).toBe("Alice");
    expect(mockDb.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { category: "ROMANTIC" },
      }),
    );
  });

  it("should return empty array when category has no characters", async () => {
    mockCharacterCache.getCachedCharacters.mockResolvedValue(null);
    mockDb.character.findMany.mockResolvedValue([]);

    const { charactersRouter } = await import("../characters");
    // @ts-expect-error — query handler is captured at module import time
    const handler: ListHandler = charactersRouter.list.handler;

    const result = await handler({ input: { category: "HORROR" } });

    expect(result).toEqual([]);
  });

  it("should query DB when cache returns null (miss)", async () => {
    mockCharacterCache.getCachedCharacters.mockResolvedValue(null);
    mockDb.character.findMany.mockResolvedValue(MOCK_CHARACTERS);

    const { charactersRouter } = await import("../characters");
    // @ts-expect-error — query handler is captured at module import time
    const handler: ListHandler = charactersRouter.list.handler;

    await handler({ input: {} });

    expect(mockDb.character.findMany).toHaveBeenCalledTimes(1);
    expect(mockCharacterCache.setCachedCharacters).toHaveBeenCalledTimes(1);
  });

  it("should order by isFeatured desc then name asc", async () => {
    mockCharacterCache.getCachedCharacters.mockResolvedValue(null);
    mockDb.character.findMany.mockResolvedValue(MOCK_CHARACTERS);

    const { charactersRouter } = await import("../characters");
    // @ts-expect-error — query handler is captured at module import time
    const handler: ListHandler = charactersRouter.list.handler;

    await handler({ input: {} });

    expect(mockDb.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
      }),
    );
  });
});

describe("charactersRouter.getBySlug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return character when found by slug", async () => {
    mockDb.character.findUnique.mockResolvedValue(MOCK_CHARACTERS[0]);

    const { charactersRouter } = await import("../characters");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetBySlugHandler = charactersRouter.getBySlug.handler;

    const result = await handler({ input: { slug: "alice" } });

    expect(result).toEqual(MOCK_CHARACTERS[0]);
    expect(mockDb.character.findUnique).toHaveBeenCalledWith({
      where: { slug: "alice" },
      select: expect.objectContaining({
        id: true,
        name: true,
        slug: true,
      }),
    });
  });

  it("should return null when character is not found", async () => {
    mockDb.character.findUnique.mockResolvedValue(null);

    const { charactersRouter } = await import("../characters");
    // @ts-expect-error — query handler is captured at module import time
    const handler: GetBySlugHandler = charactersRouter.getBySlug.handler;

    const result = await handler({ input: { slug: "nonexistent" } });

    expect(result).toBeNull();
  });
});
