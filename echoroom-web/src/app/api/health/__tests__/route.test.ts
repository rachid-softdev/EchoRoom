import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Health Check Route tests
// ---------------------------------------------------------------------------
// GET /api/health:
//   Returns health status of the application and its dependencies.
//   - Both healthy → 200 "healthy"
//   - Redis null + DB healthy → 503 "degraded"
//   - DB fails → 503 "degraded"
//   - Both fail → 503
//   - Response includes uptime, timestamp, durationMs checks

const mockDbQueryRaw = vi.fn();
const mockRedisPing = vi.fn();

vi.mock("@/server/db", () => ({
  db: { $queryRaw: mockDbQueryRaw },
}));

vi.mock("@/lib/redis", () => ({
  redis: { ping: mockRedisPing },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 with 'healthy' when both DB and Redis are healthy", async () => {
    mockDbQueryRaw.mockResolvedValue([1]);
    mockRedisPing.mockResolvedValue("PONG");

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("healthy");
    expect(body.checks.database).toBe("healthy");
    expect(body.checks.redis).toBe("healthy");
    expect(body).toHaveProperty("uptime");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("durationMs");
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.durationMs).toBe("number");
  });

  it("should return 503 'degraded' when DB fails but Redis is healthy", async () => {
    mockDbQueryRaw.mockRejectedValue(new Error("DB connection failed"));
    mockRedisPing.mockResolvedValue("PONG");

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database).toBe("unhealthy");
    expect(body.checks.redis).toBe("healthy");
  });

  it("should return 503 'degraded' when Redis fails but DB is healthy", async () => {
    mockDbQueryRaw.mockResolvedValue([1]);
    mockRedisPing.mockRejectedValue(new Error("Redis timeout"));

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database).toBe("healthy");
    expect(body.checks.redis).toBe("unhealthy");
  });

  it("should return 503 when both DB and Redis fail", async () => {
    mockDbQueryRaw.mockRejectedValue(new Error("DB down"));
    mockRedisPing.mockRejectedValue(new Error("Redis down"));

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database).toBe("unhealthy");
    expect(body.checks.redis).toBe("unhealthy");
  });

  it("should include uptime, timestamp, and durationMs fields", async () => {
    mockDbQueryRaw.mockResolvedValue([1]);
    mockRedisPing.mockResolvedValue("PONG");

    const { GET } = await import("../route");
    const response = await GET();
    const body = await response.json();

    expect(body).toHaveProperty("uptime");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("durationMs");
    expect(body).toHaveProperty("checks");

    // Validate timestamp is ISO string
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);

    // durationMs should be non-negative
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// Separate describe for the redis-null scenario (needs separate module mock)
describe("GET /api/health — redis not configured", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/server/db", () => ({
      db: { $queryRaw: vi.fn().mockResolvedValue([1]) },
    }));
    vi.doMock("@/lib/redis", () => ({
      redis: null,
    }));
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("should return 503 'degraded' when Redis is not configured (null) but DB is healthy", async () => {
    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database).toBe("healthy");
    expect(body.checks.redis).toBe("unhealthy");
  });

  it("should return 503 when both DB fails and Redis is null", async () => {
    vi.doMock("@/server/db", () => ({
      db: { $queryRaw: vi.fn().mockRejectedValue(new Error("DB error")) },
    }));

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database).toBe("unhealthy");
    expect(body.checks.redis).toBe("unhealthy");
  });
});
