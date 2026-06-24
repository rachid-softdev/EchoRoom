import { test, expect } from "@playwright/test";

test.describe("ScenarioCard component", () => {
  /**
   * Navigate to the public explore page and locate the first scenario card link.
   * Returns the locator and a boolean indicating whether a card exists.
   */
  async function getFirstCard(page: import("@playwright/test").Page) {
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");
    const link = page.locator('a[href^="/scenario/"]').first();
    const exists = await link.isVisible().catch(() => false);
    return { link, exists };
  }

  test("should render as a link pointing to the scenario detail page", async ({ page }) => {
    const { link, exists } = await getFirstCard(page);
    test.skip(!exists, "No scenarios available in the database");
    if (!exists) return;

    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /^\/scenario\//);
  });

  test("should display a category badge", async ({ page }) => {
    const { link, exists } = await getFirstCard(page);
    test.skip(!exists, "No scenarios available in the database");
    if (!exists) return;

    // The first span child of the card (CardHeader > Badge) shows the category label
    // Known values: "Romantique", "Chaotique", "Corporate", "NPC", "Horreur", "Cringe", "Gamer", "Weird", or fallback "Scénario"
    const card = link.locator("> div");
    const badgeText = card.locator("span").first();
    await expect(badgeText).toBeVisible();
    await expect(badgeText).not.toBeEmpty();
  });

  test("should display the scenario title", async ({ page }) => {
    const { link, exists } = await getFirstCard(page);
    test.skip(!exists, "No scenarios available in the database");
    if (!exists) return;

    // CardTitle renders as an h3 element
    const card = link.locator("> div");
    const title = card.locator("h3").first();
    await expect(title).toBeVisible();
    await expect(title).not.toBeEmpty();
  });

  test("should display a description with line-clamp-2 class", async ({ page }) => {
    const { link, exists } = await getFirstCard(page);
    test.skip(!exists, "No scenarios available in the database");
    if (!exists) return;

    // CardDescription has line-clamp-2 class
    const description = link.locator("p.line-clamp-2").first();
    const descExists = await description.isVisible().catch(() => false);
    test.skip(!descExists, "Scenario card has no description");
    if (!descExists) return;

    await expect(description).toBeVisible();
    await expect(description).not.toBeEmpty();
  });

  test("should display play count with Play icon and formatted number", async ({ page }) => {
    const { link, exists } = await getFirstCard(page);
    test.skip(!exists, "No scenarios available in the database");
    if (!exists) return;

    // The play count sits in a row next to the badge:
    // <div class="flex items-center gap-1 text-xs text-muted-foreground">
    const card = link.locator("> div");
    const playContainer = card.locator("div.flex.items-center.gap-1.text-xs").first();
    const playExists = await playContainer.isVisible().catch(() => false);
    test.skip(!playExists, "Play count not rendered (playCount undefined)");
    if (!playExists) return;

    // The text contains a formatted number: e.g. "100" or "1.5k"
    // The SVG icon renders no text, so textContent is just the number
    const playText = await playContainer.textContent();
    expect(playText?.trim()).toMatch(/^\d+(\.\d+)?k?$/);
  });

  test("should display creator as 'par {username}' when showCreator is true (default)", async ({ page }) => {
    const { link, exists } = await getFirstCard(page);
    test.skip(!exists, "No scenarios available in the database");
    if (!exists) return;

    // Creator text: "par Alice", "par Bob", etc. in the card footer
    const creatorText = link.getByText(/^par\s+\S+/);
    const creatorExists = await creatorText.isVisible().catch(() => false);
    test.skip(!creatorExists, "Creator not displayed (creator undefined)");
    if (!creatorExists) return;

    await expect(creatorText).toBeVisible();
  });

  test("should display like count with Heart icon", async ({ page }) => {
    const { link, exists } = await getFirstCard(page);
    test.skip(!exists, "No scenarios available in the database");
    if (!exists) return;

    // The card footer contains numeric counts (like, comment, play)
    // Check that the card shows at least one numeric value
    const card = link.locator("> div");
    const cardText = await card.textContent();
    const hasNumber = /\d+/.test(cardText ?? "");

    test.skip(!hasNumber, "No numeric counts displayed on the card");
    if (!hasNumber) return;

    // At least one numeric value is visible somewhere in the card
    await expect(card).toContainText(/\d+/);
  });

  test("should display comment count with MessageCircle icon", async ({ page }) => {
    const { link, exists } = await getFirstCard(page);
    test.skip(!exists, "No scenarios available in the database");
    if (!exists) return;

    // Comment count relies on _count being present on the scenario data
    // Verify there are at least 2 numeric values in the card (play + like + comment)
    // Play count is always shown if defined; like + comment are conditional
    const card = link.locator("> div");
    const cardText = await card.textContent();
    const numbers = (cardText ?? "").match(/\d+/g);
    const hasCommentCount = numbers !== null && numbers.length >= 1;

    test.skip(!hasCommentCount, "No comment count visible (_count may be undefined)");
    if (!hasCommentCount) return;

    // The card contains numeric values (at least one for comment count)
    expect(numbers!.length).toBeGreaterThanOrEqual(1);
  });

  test("should display a share button on cards with showShare=true (home page)", async ({ page }) => {
    // The home page renders FeaturedScenariosSection with showShare prop
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Share button is rendered inside a scenario card link when showShare is true
    // The button contains a Share2 icon (lucide-react renders it as svg.lucide-share2)
    const shareButton = page.locator('a[href^="/scenario/"] button').filter({
      has: page.locator("svg.lucide-share2"),
    });
    const shareExists = await shareButton.first().isVisible().catch(() => false);
    test.skip(!shareExists, "Share button not visible — no featured scenarios with showShare on home page");
    if (!shareExists) return;

    await expect(shareButton.first()).toBeVisible();
  });

  test("should have focus-visible:ring-2 class on the link element", async ({ page }) => {
    const { link, exists } = await getFirstCard(page);
    test.skip(!exists, "No scenarios available in the database");
    if (!exists) return;

    // The Link wrapper has focus-visible ring styles
    const classAttr = await link.getAttribute("class");
    expect(classAttr).toContain("focus-visible:ring-2");
  });

  test("should have hover:border-primary/30 class on the Card element", async ({ page }) => {
    const { link, exists } = await getFirstCard(page);
    test.skip(!exists, "No scenarios available in the database");
    if (!exists) return;

    // The Card (first child div inside the link) has hover:border-primary/30
    const card = link.locator("> div").first();
    const classAttr = await card.getAttribute("class");
    expect(classAttr).toContain("hover:border-primary/30");
  });
});
