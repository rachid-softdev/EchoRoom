import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — EchoRoom AI",
  description:
    "Politique de confidentialité et protection des données personnelles d'EchoRoom AI.",
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold mb-8">Politique de confidentialité</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Dernière mise à jour : janvier 2025
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Données collectées</h2>
        <p className="text-muted-foreground leading-relaxed">
          Nous collectons les données suivantes lors de votre inscription et de votre
          utilisation du service :
        </p>
        <ul className="list-disc pl-6 mt-2 text-muted-foreground space-y-1">
          <li>Adresse email</li>
          <li>Nom d&apos;utilisateur</li>
          <li>Mot de passe (crypté)</li>
          <li>Numéro de téléphone (pour les appels)</li>
          <li>Enregistrements audio des appels</li>
          <li>Contenu des scénarios et commentaires</li>
          <li>Données de navigation et d&apos;utilisation</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Base légale du traitement</h2>
        <p className="text-muted-foreground leading-relaxed">
          Le traitement de vos données repose sur les bases légales suivantes :
        </p>
        <ul className="list-disc pl-6 mt-2 text-muted-foreground space-y-1">
          <li>
            <strong>Exécution du contrat</strong> : nécessaire pour fournir le service
            que vous avez demandé
          </li>
          <li>
            <strong>Consentement</strong> : pour le traitement des données non
            essentielles (cookies analytiques, communications marketing)
          </li>
          <li>
            <strong>Intérêt légitime</strong> : pour la modération du contenu et
            l&apos;amélioration du service
          </li>
          <li>
            <strong>Obligation légale</strong> : pour respecter nos obligations
            réglementaires
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Destinataires des données</h2>
        <p className="text-muted-foreground leading-relaxed">
          Vos données peuvent être partagées avec :
        </p>
        <ul className="list-disc pl-6 mt-2 text-muted-foreground space-y-1">
          <li>Notre hébergeur (Vercel Inc., États-Unis)</li>
          <li>Notre fournisseur de base de données (Supabase / Neon)</li>
          <li>Notre fournisseur de téléphonie (Twilio / VAPI)</li>
          <li>Notre service de paiement (Stripe)</li>
          <li>Autorités compétentes en cas d&apos;obligation légale</li>
        </ul>
        <p className="text-muted-foreground mt-2">
          Ces sous-traitants sont soumis à des clauses contractuelles garantissant un
          niveau de protection adéquat conformément au RGPD.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Durée de conservation</h2>
        <p className="text-muted-foreground leading-relaxed">
          Nous conservons vos données aussi longtemps que votre compte est actif. En cas
          de suppression de compte, vos données personnelles sont anonymisées dans un
          délai de 30 jours. Les enregistrements audio sont conservés 90 jours maximum.
          Les données de journalisation sont conservées 12 mois.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Vos droits (RGPD)</h2>
        <p className="text-muted-foreground leading-relaxed">
          Conformément au Règlement Général sur la Protection des Données (RGPD), vous
          disposez des droits suivants :
        </p>
        <ul className="list-disc pl-6 mt-2 text-muted-foreground space-y-1">
          <li>Droit d&apos;accès à vos données personnelles</li>
          <li>Droit de rectification des données inexactes</li>
          <li>Droit à l&apos;effacement (&quot;droit à l&apos;oubli&quot;)</li>
          <li>Droit à la limitation du traitement</li>
          <li>Droit à la portabilité des données</li>
          <li>Droit d&apos;opposition au traitement</li>
        </ul>
        <p className="text-muted-foreground mt-2">
          Pour exercer vos droits, connectez-vous à votre compte et utilisez la section
          &quot;Paramètres&quot; ou contactez-nous à l&apos;adresse ci-dessous. Nous répondrons
          à votre demande dans un délai de 30 jours.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Cookies</h2>
        <p className="text-muted-foreground leading-relaxed">
          Nous utilisons uniquement des cookies techniques nécessaires au fonctionnement
          du service (session, authentification). Nous n&apos;utilisons pas de cookies
          publicitaires ou de traçage tiers. Des cookies analytiques (PostHog) peuvent
          être utilisés avec votre consentement pour améliorer nos services.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Contact</h2>
        <p className="text-muted-foreground leading-relaxed">
          Pour toute question concernant notre politique de confidentialité ou
          l&apos;exercice de vos droits, contactez notre Délégué à la Protection des
          Données :
          <br />
          <a
            href="mailto:dpo@echoroom.app"
            className="text-primary hover:underline"
          >
            dpo@echoroom.app
          </a>
        </p>
      </section>
    </article>
  );
}
