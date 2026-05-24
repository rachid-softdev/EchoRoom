import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions d'utilisation — EchoRoom AI",
  description:
    "Conditions générales d'utilisation de la plateforme EchoRoom AI.",
};

export default function TermsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-bold mb-8">Conditions d&apos;utilisation</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Dernière mise à jour : janvier 2025
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Acceptation des conditions</h2>
        <p className="text-muted-foreground leading-relaxed">
          En accédant à la plateforme EchoRoom AI, vous acceptez d&apos;être lié par les
          présentes conditions d&apos;utilisation. Si vous n&apos;acceptez pas ces conditions,
          veuillez ne pas utiliser nos services.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Description du service</h2>
        <p className="text-muted-foreground leading-relaxed">
          EchoRoom AI est une plateforme de divertissement social qui permet aux
          utilisateurs de créer, partager et interagir avec des scénarios d&apos;appels
          téléphoniques générés par intelligence artificielle. Les utilisateurs peuvent
          simuler des conversations avec divers personnages IA dans différents contextes
          scénaristiques.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Crédits et paiements</h2>
        <p className="text-muted-foreground leading-relaxed">
          Les appels IA consomment des crédits. Des crédits gratuits sont offerts aux
          nouveaux utilisateurs. Des crédits supplémentaires peuvent être achetés via les
          offres proposées sur la plateforme. Les crédits achetés sont non remboursables,
          sauf disposition légale contraire. Les crédits gratuits n&apos;ont aucune valeur
          monétaire et expirent après 30 jours.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Contenu utilisateur</h2>
        <p className="text-muted-foreground leading-relaxed">
          Vous conservez vos droits sur le contenu que vous créez. En publiant un
          scénario ou un commentaire sur EchoRoom AI, vous accordez à la plateforme une
          licence non exclusive, gratuite et mondiale pour afficher, distribuer et
          promouvoir ce contenu au sein du service. Vous garantissez que votre contenu
          ne viole pas les droits de tiers ni les lois applicables.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Modération</h2>
        <p className="text-muted-foreground leading-relaxed">
          EchoRoom AI se réserve le droit de modérer, masquer ou supprimer tout contenu
          qui enfreint nos règles ou les lois applicables. Les utilisateurs peuvent
          signaler un contenu abusif via les outils de signalement disponibles sur la
          plateforme. Les décisions de modération sont prises à notre seule discrétion.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Propriété intellectuelle</h2>
        <p className="text-muted-foreground leading-relaxed">
          Le nom et le logo EchoRoom AI, l&apos;interface utilisateur, le code source et
          les technologies sous-jacentes sont la propriété exclusive d&apos;EchoRoom AI.
          Les personnages IA et les scénarios prédéfinis sont protégés par le droit
          d&apos;auteur. Toute reproduction ou utilisation non autorisée est interdite.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Limitation de responsabilité</h2>
        <p className="text-muted-foreground leading-relaxed">
          EchoRoom AI est fourni &quot;tel quel&quot; sans garantie d&apos;aucune sorte. Nous ne
          sommes pas responsables des dommages directs ou indirects résultant de
          l&apos;utilisation du service. Les conversations générées par IA sont à but
          de divertissement uniquement et ne doivent pas être considérées comme des
          conseils professionnels.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Contact</h2>
        <p className="text-muted-foreground leading-relaxed">
          Pour toute question concernant ces conditions, contactez-nous à :
          <br />
          <a
            href="mailto:legal@echoroom.app"
            className="text-primary hover:underline"
          >
            legal@echoroom.app
          </a>
        </p>
      </section>
    </article>
  );
}
