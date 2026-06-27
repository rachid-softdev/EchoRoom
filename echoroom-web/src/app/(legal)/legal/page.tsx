import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales — EchoRoom AI",
  description: "Mentions légales de la plateforme EchoRoom AI.",
};

export default function LegalPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold mb-8">Mentions légales</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Conformément aux dispositions de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans
        l&apos;économie numérique.
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Éditeur</h2>
        <div className="text-muted-foreground leading-relaxed space-y-1">
          <p>EchoRoom AI</p>
          <p>Société par actions simplifiée (SAS)</p>
          <p>Immatriculée au RCS de Paris sous le numéro 900 123 456</p>
          <p>Numéro de TVA intracommunautaire : FR45900123456</p>
          <p>Siège social : 128 Rue de Rivoli, 75001 Paris, France</p>
          <p>
            Email :{" "}
            <a href="mailto:contact@echoroom.app" className="text-primary hover:underline">
              contact@echoroom.app
            </a>
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Directeur de la publication</h2>
        <p className="text-muted-foreground leading-relaxed">
          Le directeur de la publication est le représentant légal d&apos;EchoRoom AI.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Hébergement</h2>
        <div className="text-muted-foreground leading-relaxed space-y-1">
          <p>Vercel Inc.</p>
          <p>440 N Barranca Ave #4133</p>
          <p>Covina, CA 91723, États-Unis</p>
          <p>
            Site web :{" "}
            <a
              href="https://vercel.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              https://vercel.com
            </a>
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Contact</h2>
        <div className="text-muted-foreground leading-relaxed space-y-1">
          <p>
            Support utilisateur :{" "}
            <a href="mailto:support@echoroom.app" className="text-primary hover:underline">
              support@echoroom.app
            </a>
          </p>
          <p>
            Réclamations juridiques :{" "}
            <a href="mailto:legal@echoroom.app" className="text-primary hover:underline">
              legal@echoroom.app
            </a>
          </p>
          <p>
            Protection des données :{" "}
            <a href="mailto:dpo@echoroom.app" className="text-primary hover:underline">
              dpo@echoroom.app
            </a>
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Crédits</h2>
        <div className="text-muted-foreground leading-relaxed space-y-1">
          <p>Design et développement : Équipe EchoRoom AI</p>
          <p>
            Icônes :{" "}
            <a
              href="https://lucide.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Lucide
            </a>
          </p>
          <p>Police : Inter (SIL Open Font License)</p>
        </div>
      </section>
    </article>
  );
}
