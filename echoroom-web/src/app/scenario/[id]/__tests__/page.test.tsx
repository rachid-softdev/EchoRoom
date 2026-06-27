import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// ScenarioPage (server component) tests
// ---------------------------------------------------------------------------
// The page:
//   - Calls db.scenario.findUnique with the params.id
//   - If scenario is null → calls notFound() (which throws)
//   - If scenario exists → renders <ScenarioDetailClient scenarioId={...} />
// generateMetadata:
//   - Returns generic metadata for missing/private/unlisted scenarios
//   - Returns detailed metadata for public scenarios

const mockFindUnique = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    scenario: {
      findUnique: mockFindUnique,
    },
  },
}));

const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

// Mock the ScenarioDetailClient child component
vi.mock("../ScenarioDetailClient", () => ({
  ScenarioDetailClient: ({ scenarioId }: { scenarioId: string }) => (
    <div data-testid="scenario-detail-client" data-scenario-id={scenarioId} />
  ),
}));

afterEach(() => {
  cleanup();
});

describe("ScenarioPage (server component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("page rendering", () => {
    it("renders ScenarioDetailClient when scenario exists", async () => {
      mockFindUnique.mockResolvedValue({ id: "s-1" });

      const mod = await import("../page");
      const ScenarioPage = mod.default;

      const element = await ScenarioPage({ params: { id: "s-1" } });
      render(element);

      expect(screen.getByTestId("scenario-detail-client")).toBeInTheDocument();
      expect(screen.getByTestId("scenario-detail-client")).toHaveAttribute(
        "data-scenario-id",
        "s-1",
      );
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it("calls notFound when scenario does not exist", async () => {
      mockFindUnique.mockResolvedValue(null);

      const mod = await import("../page");
      const ScenarioPage = mod.default;

      await ScenarioPage({ params: { id: "nonexistent" } });

      expect(mockNotFound).toHaveBeenCalled();
    });

    it("queries the database with the correct params.id", async () => {
      mockFindUnique.mockResolvedValue({ id: "s-42" });

      const mod = await import("../page");
      const ScenarioPage = mod.default;

      await ScenarioPage({ params: { id: "s-42" } });

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: "s-42" },
        select: { id: true },
      });
    });
  });

  describe("generateMetadata", () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      process.env = { ...OLD_ENV };
      process.env["NEXT_PUBLIC_APP_URL"] = "https://echoroom.app";
    });

    afterEach(() => {
      process.env = OLD_ENV;
    });

    it("returns generic metadata for null scenario", async () => {
      mockFindUnique.mockResolvedValue(null);

      const { generateMetadata } = await import("../page");
      const metadata = await generateMetadata({ params: { id: "s-1" } });

      expect(metadata.title).toBe("EchoRoom AI");
      expect(metadata.description).toContain("Créez des appels IA absurdes");
    });

    it("returns generic metadata for PRIVATE scenario", async () => {
      mockFindUnique.mockResolvedValue({
        title: "Secret Scenario",
        description: "Shh",
        visibility: "PRIVATE",
        character: { name: "Robot", avatarUrl: null },
        creator: { username: "creator1" },
      });

      const { generateMetadata } = await import("../page");
      const metadata = await generateMetadata({ params: { id: "s-1" } });

      expect(metadata.title).toBe("EchoRoom AI");
    });

    it("returns generic metadata for UNLISTED scenario", async () => {
      mockFindUnique.mockResolvedValue({
        title: "Hidden Scenario",
        description: "Hidden",
        visibility: "UNLISTED",
        character: { name: "AI", avatarUrl: null },
        creator: { username: "anon" },
      });

      const { generateMetadata } = await import("../page");
      const metadata = await generateMetadata({ params: { id: "s-1" } });

      expect(metadata.title).toBe("EchoRoom AI");
    });

    it("returns detailed metadata for PUBLIC scenario", async () => {
      mockFindUnique.mockResolvedValue({
        title: "My Cool Scenario",
        description: "A very cool scenario description",
        visibility: "PUBLIC",
        character: { name: "Cool Bot", avatarUrl: "https://example.com/avatar.png" },
        creator: { username: "coolcreator" },
      });

      const { generateMetadata } = await import("../page");
      const metadata = await generateMetadata({ params: { id: "s-1" } });

      expect(metadata.title).toBe("My Cool Scenario — EchoRoom AI");
      expect(metadata.description).toBe("A very cool scenario description");
      expect(metadata.openGraph?.title).toBe("My Cool Scenario — EchoRoom AI");
      expect(metadata.twitter?.title).toBe("My Cool Scenario — EchoRoom AI");
    });

    it("uses fallback description when scenario description is null", async () => {
      mockFindUnique.mockResolvedValue({
        title: "No Desc Scenario",
        description: null,
        visibility: "PUBLIC",
        character: { name: "Bot", avatarUrl: null },
        creator: { username: "user1" },
      });

      const { generateMetadata } = await import("../page");
      const metadata = await generateMetadata({ params: { id: "s-1" } });

      expect(metadata.description).toContain("Bot");
      expect(metadata.description).toContain("user1");
    });

    it("uses fallback text when character is null", async () => {
      mockFindUnique.mockResolvedValue({
        title: "No Char Scenario",
        description: null,
        visibility: "PUBLIC",
        character: null,
        creator: { username: "user1" },
      });

      const { generateMetadata } = await import("../page");
      const metadata = await generateMetadata({ params: { id: "s-1" } });

      expect(metadata.description).toContain("EchoRoom");
    });

    it("uses fallback text when creator is null", async () => {
      mockFindUnique.mockResolvedValue({
        title: "No Creator Scenario",
        description: null,
        visibility: "PUBLIC",
        character: { name: "Bot", avatarUrl: null },
        creator: null,
      });

      const { generateMetadata } = await import("../page");
      const metadata = await generateMetadata({ params: { id: "s-1" } });

      expect(metadata.description).toContain("un membre");
    });

    it("includes OG image URL for public scenarios", async () => {
      mockFindUnique.mockResolvedValue({
        title: "OG Scenario",
        description: "OG desc",
        visibility: "PUBLIC",
        character: { name: "OG Bot", avatarUrl: null },
        creator: { username: "ogcreator" },
      });

      const { generateMetadata } = await import("../page");
      const metadata = await generateMetadata({ params: { id: "s-og" } });

      expect(metadata.openGraph?.images).toEqual([
        { url: "https://echoroom.app/api/og?id=s-og", width: 1200, height: 630 },
      ]);
      expect(metadata.twitter?.images).toEqual(["https://echoroom.app/api/og?id=s-og"]);
    });
  });
});
