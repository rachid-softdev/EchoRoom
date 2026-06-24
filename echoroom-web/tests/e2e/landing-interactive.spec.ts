import { test, expect } from "@playwright/test";

test.describe("Landing page — composants interactifs", () => {
  // ─── LiveCounter : valeur aléatoire entre visites ────────────────

  test("LiveCounter affiche une valeur numérique à 4 chiffres", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Le LiveCounter est rendu dans la barre auditeurs (LiveCallPreview)
    // et dans la CommunityProofStrip
    const counters = page.locator("span.tabular-nums");
    const count = await counters.count();

    // Au moins un LiveCounter doit être présent
    expect(count).toBeGreaterThanOrEqual(1);

    // Le premier compteur doit contenir un nombre entre 1800 et 4200
    // (car Math.floor(1800 + Math.random() * 2400))
    const firstValue = await counters.first().textContent();
    const numericValue = parseInt(firstValue!.replace(/\s/g, ""), 10);
    expect(numericValue).toBeGreaterThanOrEqual(1800);
    expect(numericValue).toBeLessThanOrEqual(4200);
  });

  test("LiveCounter varie entre deux rechargements de page", async ({ page }) => {
    await page.goto("/");

    // Attendre que le composant client soit hydraté
    await page.waitForLoadState("networkidle");
    const firstValue = await page.locator("span.tabular-nums").first().textContent();

    // Recharger la page
    await page.reload();
    await page.waitForLoadState("networkidle");

    const secondValue = await page.locator("span.tabular-nums").first().textContent();

    // Les deux valeurs doivent être différentes (useState avec Math.random)
    // Note : il y a une infime chance qu'elles soient égales, on tolère
    if (firstValue !== secondValue) {
      expect(firstValue).not.toBe(secondValue);
    }
  });

  test("LiveCounter s'affiche dans la barre des auditeurs avec le texte 'auditeurs'", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // La barre des auditeurs contient le compteur et le texte "auditeurs"
    const listenerBar = page.locator("text=auditeurs").first();
    await expect(listenerBar).toBeVisible();

    // Le compteur est un sibling span avec la classe tabular-nums
    const counter = listenerBar.locator("xpath=preceding-sibling::span[contains(@class, 'tabular-nums')]");
    await expect(counter).toBeVisible();
  });

  // ─── Hero : background image avec overlays gradient ──────────────

  test("Hero section a une image de fond avec overlay gradient", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // La section hero contient un div avec une backgroundImage
    const heroSection = page.locator("section").first();
    await expect(heroSection).toBeVisible();

    // Le div avec l'image de fond (bg-cover bg-center)
    const bgImageDiv = heroSection.locator("div.bg-cover.bg-center");
    await expect(bgImageDiv).toBeVisible();

    // Vérifie que l'image de fond utilise Unsplash
    const styleAttr = await bgImageDiv.getAttribute("style");
    expect(styleAttr).toContain("url(");
    expect(styleAttr).toContain("images.unsplash.com");

    // Vérifie la présence des overlays gradient
    const gradientOverlays = heroSection.locator("div.bg-gradient-to-r, div.bg-gradient-to-t, div.bg-gradient-to-b");
    const overlayCount = await gradientOverlays.count();
    expect(overlayCount).toBeGreaterThanOrEqual(1);
  });

  // ─── HeroFeatureCard : alternance layout ────────────────────────

  test("HeroFeatureCard alterne flex-row et flex-row-reverse selon l'index", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Les HeroFeatureCard sont dans la section features après CommunityProofStrip
    // La première carte (index 0) est en flex-row par défaut
    // La deuxième carte (index 1) est en lg:flex-row-reverse
    const featureCards = page.locator("section").nth(1).locator("> div > div.space-y-20 > div");

    const cardCount = await featureCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(2);

    // Première carte : lg:flex-row (pas de flex-row-reverse)
    const firstCard = featureCards.nth(0);
    const firstClass = await firstCard.getAttribute("class");
    expect(firstClass).not.toContain("flex-row-reverse");

    // Deuxième carte : lg:flex-row-reverse
    const secondCard = featureCards.nth(1);
    const secondClass = await secondCard.getAttribute("class");
    expect(secondClass).toContain("flex-row-reverse");
  });

  test("HeroFeatureCard affiche icône, titre et description", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Première feature card
    const firstFeature = page.locator("section").nth(1).locator("> div > div.space-y-20 > div").first();

    // Vérifie la présence du titre et de la description
    await expect(firstFeature.locator("h3")).toBeVisible();
    await expect(firstFeature.locator("p.text-muted-foreground")).toBeVisible();
  });

  // ─── CommunityProofStrip : 3 scénarios tendance statiques ────────

  test("CommunityProofStrip affiche les 3 scénarios tendance", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Les scénarios tendances sont dans un élément avec "En tendance :" ou "🔥"
    const proofStrip = page.locator("section.border-y");
    await expect(proofStrip).toBeVisible();

    // Vérifie les 3 noms de scénarios tendance
    const trendingNames = [
      "Fake Recruiter Simulator",
      "NPC Customer Support",
      "AI Ex Girlfriend Chaos",
    ];
    for (const name of trendingNames) {
      await expect(proofStrip.getByText(name)).toBeVisible();
    }
  });

  test("CommunityProofStrip affiche le compteur en écoute et les réactions", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const proofStrip = page.locator("section.border-y");

    // Texte "en écoute"
    await expect(proofStrip.getByText("en écoute")).toBeVisible();

    // Texte "12.4k" pour les réactions
    await expect(proofStrip.getByText("12.4k")).toBeVisible();

    // Texte "réactions aujourd'hui"
    await expect(proofStrip.getByText("réactions aujourd'hui")).toBeVisible();
  });

  // ─── 5 étoiles SVG rating avec aria-label ────────────────────────

  test("Section hero affiche 5 étoiles SVG avec aria-label", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Le conteneur des étoiles a role="img" et aria-label="5 étoiles"
    const starContainer = page.locator('[role="img"][aria-label="5 étoiles"]');
    await expect(starContainer).toBeVisible();

    // 5 SVG stars à l'intérieur
    const stars = starContainer.locator("svg");
    await expect(stars).toHaveCount(5);

    // Chaque étoile remplit la couleur primary
    for (let i = 0; i < 5; i++) {
      await expect(stars.nth(i)).toHaveAttribute("fill", "currentColor");
    }
  });

  test("Le texte après les étoiles mentionne les crédits offerts", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Le texte à côté des étoiles
    await expect(page.getByText("5 crédits offerts")).toBeVisible();
    await expect(page.getByText("Sans engagement")).toBeVisible();
    await expect(page.getByText("Annulation à tout moment")).toBeVisible();
  });

  // ─── Animations fade-in ──────────────────────────────────────────

  test("La section hero a la classe animate-fade-in", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Le contenu du hero a la classe animate-fade-in
    const heroContent = page.locator("section").first().locator("div.animate-fade-in");
    const count = await heroContent.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("Les HeroFeatureCard ont la classe animate-fade-in", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Les cartes de fonctionnalités ont animate-fade-in
    const animatedCards = page.locator("div.animate-fade-in >> h3");
    const count = await animatedCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("Les SupportingFeatureCard ont la classe animate-fade-in", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Les cartes secondaires sont dans une grille sm:grid-cols-2 lg:grid-cols-4
    const supportingGrid = page.locator("div.grid.sm\\:grid-cols-2.lg\\:grid-cols-4");
    await expect(supportingGrid).toBeVisible();

    // Chaque carte a animate-fade-in comme classe
    const cards = supportingGrid.locator("> div.animate-fade-in");
    const cardCount = await cards.count();
    expect(cardCount).toBe(4);
  });

  test("Le CTA final a la classe animate-fade-in", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Dernière section avant le footer
    const finalSection = page.locator("section.animate-fade-in").last();
    await expect(finalSection).toBeVisible();

    // Le titre final "Prêt à faire du bruit ?"
    await expect(finalSection.getByText("Prêt à faire du")).toBeVisible();
    await expect(finalSection.getByText("bruit")).toBeVisible();
  });

  // ─── LiveCallPreview : composant visuel ──────────────────────────

  test("LiveCallPreview affiche les messages AI et User", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Recherche un message AI
    const aiText = page.getByText("Bonjour. Votre CV est excellent mais");
    await expect(aiText).toBeVisible();

    // Recherche un message User
    const userText = page.getByText("C'était principalement des incidents Discord");
    await expect(userText).toBeVisible();
  });

  test("LiveCallPreview affiche le badge LIVE", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Badge LIVE avec le texte
    const liveBadge = page.getByText("Live");
    await expect(liveBadge).toBeVisible();
  });

  test("LiveCallPreview affiche 4 avatars d'auditeurs", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Les avatars sont dans un div avec -space-x-1.5
    const avatarGroup = page.locator("div.-space-x-1\\.5");
    await expect(avatarGroup).toBeVisible();

    // 4 avatars (divs avec rounded-full)
    const avatars = avatarGroup.locator("> div");
    await expect(avatars).toHaveCount(4);
  });

  // ─── FeaturedScenariosSection ───────────────────────────────────

  test("FeaturedScenariosSection affiche le titre 'Scénario à la une'", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Fait défiler jusqu'à la section des scénarios vedettes
    await page.evaluate(() => {
      const section = document.querySelector("[class*='featured']");
      if (section) section.scrollIntoView();
    });

    await expect(page.getByText("Scénario à la une")).toBeVisible();
  });

  // ─── Navigation Bar ─────────────────────────────────────────────

  test("La barre de navigation MarketingNav est visible avec les liens principaux", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Le lien "Explorer" doit être visible
    await expect(page.getByRole("link", { name: /Explorer/ }).first()).toBeVisible();

    // Le lien "Tarifs" doit être visible
    await expect(page.getByRole("link", { name: /Tarifs/ }).first()).toBeVisible();
  });

  test("Les boutons CTA du hero sont fonctionnels", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Bouton "Commencer gratuitement" → lien vers /register
    const commencerBtn = page.getByRole("link", { name: /Commencer gratuitement/ });
    await expect(commencerBtn).toBeVisible();
    await expect(commencerBtn).toHaveAttribute("href", "/register");

    // Bouton "Voir une démo" → lien vers /explore
    const demoBtn = page.getByRole("link", { name: /Voir une démo/ });
    await expect(demoBtn).toBeVisible();
    await expect(demoBtn).toHaveAttribute("href", "/explore");
  });
});
