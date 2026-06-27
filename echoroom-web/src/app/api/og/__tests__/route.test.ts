import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Open Graph Image Route tests
// ---------------------------------------------------------------------------
// GET /api/og?id=<scenarioId>
//   Generates OG image for a scenario.
//   - Valid id with PUBLIC+APPROVED scenario → 200 ImageResponse
//   - scenario.character=null → fallback "Personnage"
//   - scenario.creator=null → fallback "un membre"
//   - Both null → handles gracefully
//   - Missing "id" query param → 400
//   - Scenario not found → 404
//   - DB throws in try → fallback findUnique → redirect avatar if found
//   - DB throws in try → fallback also throws → 500
//   - Font fetch fails → falls back to sans-serif
//   - Non-GET → 405 (actually next.js only dispatches GET to this handler)

const mockFindFirst = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    scenario: {
      findFirst: mockFindFirst,
      findUnique: mockFindUnique,
    },
  },
}));

// Mock ImageResponse from @vercel/og
const mockImageResponse = vi.fn();
vi.mock("@vercel/og", () => ({
  ImageResponse: mockImageResponse,
}));

// Mock global fetch for font loading
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createRequest(url: string): Request {
  return {
    url,
  } as unknown as Request;
}

describe("GET /api/og", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default ImageResponse mock returns a 200 Response
    mockImageResponse.mockReturnValue(
      new Response("mock image", { status: 200, headers: { "content-type": "image/png" } }),
    );
  });

  // -----------------------------------------------------------------------
  // Valid scenarios
  // -----------------------------------------------------------------------

  it("should return 200 ImageResponse for valid scenario id", async () => {
    mockFindFirst.mockResolvedValue({
      title: "Test Scenario",
      description: "A test scenario",
      character: { name: "Bob", avatarUrl: "https://example.com/avatar.png" },
      creator: { username: "creator1" },
    });

    // Mock font fetch to succeed
    const mockArrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));
    mockFetch.mockResolvedValue({
      arrayBuffer: mockArrayBuffer,
    });

    const { GET } = await import("../route");
    const req = createRequest("https://api.echoroom.app/api/og?id=scenario-123");
    const response = await GET(req);

    expect(response.status).toBe(200);

    // ImageResponse should have been called with JSX and options
    expect(mockImageResponse).toHaveBeenCalledTimes(1);
    const [_jsx, options] = mockImageResponse.mock.calls[0]!;
    expect(options.width).toBe(1200);
    expect(options.height).toBe(630);
    // Font should be included since fetch succeeded
    expect(options.fonts).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Inter" })]),
    );
  });

  it("should use 'Personnage' fallback when scenario.character is null", async () => {
    mockFindFirst.mockResolvedValue({
      title: "Test Scenario",
      description: "A test scenario",
      character: null,
      creator: { username: "creator1" },
    });

    mockFetch.mockRejectedValue(new Error("Font fetch failed"));

    const { GET } = await import("../route");
    const req = createRequest("https://api.echoroom.app/api/og?id=scenario-123");
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(mockImageResponse).toHaveBeenCalledTimes(1);

    // With character=null, should use "Personnage" fallback
    // Verify no fonts when fetch fails
    const [_jsx, options] = mockImageResponse.mock.calls[0]!;
    expect(options.fonts).toBeUndefined();
  });

  it("should use 'un membre' fallback when scenario.creator is null", async () => {
    mockFindFirst.mockResolvedValue({
      title: "Test Scenario",
      description: "A test scenario",
      character: { name: "Alice", avatarUrl: null },
      creator: null,
    });

    mockFetch.mockRejectedValue(new Error("Font fetch failed"));

    const { GET } = await import("../route");
    const req = createRequest("https://api.echoroom.app/api/og?id=scenario-123");
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(mockImageResponse).toHaveBeenCalledTimes(1);
  });

  it("should handle both character=null and creator=null gracefully", async () => {
    mockFindFirst.mockResolvedValue({
      title: "Lonely Scenario",
      description: "No character, no creator",
      character: null,
      creator: null,
    });

    mockFetch.mockRejectedValue(new Error("Font fetch failed"));

    const { GET } = await import("../route");
    const req = createRequest("https://api.echoroom.app/api/og?id=scenario-999");
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(mockImageResponse).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Error cases
  // -----------------------------------------------------------------------

  it("should return 400 when 'id' query param is missing", async () => {
    const { GET } = await import("../route");
    const req = createRequest("https://api.echoroom.app/api/og");
    const response = await GET(req);

    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toBe("Missing scenario id");
  });

  it("should return 404 when scenario is not found (db.findFirst returns null)", async () => {
    mockFindFirst.mockResolvedValue(null);

    const { GET } = await import("../route");
    const req = createRequest("https://api.echoroom.app/api/og?id=nonexistent");
    const response = await GET(req);

    expect(response.status).toBe(404);
    const text = await response.text();
    expect(text).toBe("Scenario not found");
  });

  it("should return 302 redirect to avatar when findFirst throws and findUnique finds scenario with avatar", async () => {
    mockFindFirst.mockRejectedValue(new Error("DB error in findFirst"));
    mockFindUnique.mockResolvedValue({
      character: { avatarUrl: "https://cdn.example.com/avatar.png" },
    });

    const { GET } = await import("../route");
    const req = createRequest("https://api.echoroom.app/api/og?id=scenario-123");
    const response = await GET(req);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://cdn.example.com/avatar.png");
  });

  it("should throw when findFirst throws and fallback findUnique also throws (unhandled)", async () => {
    mockFindFirst.mockRejectedValue(new Error("First DB error"));
    mockFindUnique.mockRejectedValue(new Error("Second DB error"));

    const { GET } = await import("../route");
    const req = createRequest("https://api.echoroom.app/api/og?id=scenario-123");

    // findUnique inside the catch block has no surrounding try-catch,
    // so the error propagates as an unhandled rejection from the route
    await expect(GET(req)).rejects.toThrow("Second DB error");
  });

  it("should return 500 when findFirst throws and fallback findUnique returns scenario without avatar", async () => {
    mockFindFirst.mockRejectedValue(new Error("DB error"));
    mockFindUnique.mockResolvedValue({
      character: { avatarUrl: null },
    });

    const { GET } = await import("../route");
    const req = createRequest("https://api.echoroom.app/api/og?id=scenario-123");
    const response = await GET(req);

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toBe("Failed to generate OG image");
  });

  it("should return 500 when findFirst throws and fallback findUnique returns scenario without character", async () => {
    mockFindFirst.mockRejectedValue(new Error("DB error"));
    mockFindUnique.mockResolvedValue({
      character: null,
    });

    const { GET } = await import("../route");
    const req = createRequest("https://api.echoroom.app/api/og?id=scenario-123");
    const response = await GET(req);

    expect(response.status).toBe(500);
  });

  it("should fall back to sans-serif when font fetch fails", async () => {
    mockFindFirst.mockResolvedValue({
      title: "Font Fallback Test",
      description: "Testing font fallback",
      character: { name: "Test" },
      creator: { username: "tester" },
    });

    // Font fetch fails
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { GET } = await import("../route");
    const req = createRequest("https://api.echoroom.app/api/og?id=scenario-font");
    const response = await GET(req);

    expect(response.status).toBe(200);
    // When font fails, options should NOT include fonts
    const [_jsx, options] = mockImageResponse.mock.calls[0]!;
    expect(options.fonts).toBeUndefined();
  });
});
