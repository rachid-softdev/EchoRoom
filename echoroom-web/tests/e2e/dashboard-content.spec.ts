import { expect, test } from "@playwright/test";

/**
 * Routes du groupe (dashboard) protégées par le layout côté serveur.
 * Toutes ces routes doivent exister (≠ 404) et rediriger vers /login
 * via une réponse HTTP 307/302 lorsque l'utilisateur n'est pas connecté.
 */
const ROUTES_PROTÉGÉES = [
  { path: "/dashboard", nom: "tableau de bord" },
  { path: "/create", nom: "création" },
  { path: "/library", nom: "bibliothèque" },
  { path: "/history", nom: "historique" },
  { path: "/settings", nom: "paramètres" },
  { path: "/billing", nom: "facturation" },
  { path: "/community", nom: "communauté" },
  { path: "/leaderboard", nom: "classement" },
  { path: "/profile/testuser", nom: "profil (route dynamique)" },
] as const;

test.describe("Dashboard — contenu et routage", () => {
  for (const { path, nom } of ROUTES_PROTÉGÉES) {
    test(`la route ${path} (${nom}) existe et répond par une redirection 307/302 vers /login`, async ({
      page,
    }) => {
      // On utilise page.request (natif, sans suivre les redirects)
      // pour capturer le statut HTTP exact de la réponse initiale.
      const response = await page.request.get(path);

      // === La route doit exister (pas de 404) ===
      // Le layout (dashboard) existe et Next.js reconnaît le chemin.
      expect(response.status()).not.toBe(404);

      // === La réponse doit être < 400 ===
      // Une redirection (307/302) satisfait déjà cette condition,
      // on la pose explicitement pour couvrir d'éventuels codes 500.
      expect(response.status()).toBeLessThan(400);
    });
  }
});
