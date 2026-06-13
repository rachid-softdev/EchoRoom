import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Aide & FAQ — EchoRoom AI",
  description: "Tout ce qu'il faut savoir pour utiliser EchoRoom : crédits, appels, scénarios, partage et plus.",
};

const faqs = [
  {
    q: "C'est quoi EchoRoom ?",
    a: "EchoRoom est une plateforme de divertissement social où tu peux passer des appels avec des personnages générés par IA. Crée des scénarios absurdes, lance un appel, invite tes potes à écouter en direct, et partage les meilleurs moments sur TikTok ou Discord.",
  },
  {
    q: "Comment ça marche ?",
    a: "1) Choisis ou crée un scénario (ex: « Fake Recruiter Simulator »). 2) Lance un appel — ton interlocuteur IA réagit en temps réel avec une voix réaliste. 3) Partage le moment avec la communauté ou exporte le clip. C'est tout.",
  },
  {
    q: "C'est quoi les crédits ?",
    a: "Chaque appel consomme 1 crédit. Tu reçois 5 crédits gratuits à l'inscription — sans carte bancaire. Si tu veux passer plus d'appels, tu peux acheter des packs de crédits supplémentaires dans la section Facturation.",
  },
  {
    q: "Je peux écouter les appels des autres ?",
    a: "Oui ! Quand un appel est en cours, tu peux le rejoindre en direct et réagir avec des emojis. Les appels passés sont aussi disponibles en replay dans la section Historique.",
  },
  {
    q: "Comment je partage un moment ?",
    a: "Après un appel, rends-toi sur la page de replay. Tu peux extraire un clip audio du meilleur moment et le partager directement sur TikTok, Discord, Twitter ou télécharger le fichier.",
  },
  {
    q: "Les appels sont-ils modérés ?",
    a: "Oui. EchoRoom utilise une modération automatique pour filtrer les contenus inappropriés. Les personnages IA sont fictifs et les scénarios sont créés par la communauté dans un cadre défini. Tout abus peut être signalé.",
  },
  {
    q: "C'est gratuit ?",
    a: "Oui, tu commences avec 5 crédits gratuits sans engagement. Ensuite, tu peux acheter des crédits à l'unité ou via des packs. Pas d'abonnement, pas de surprise.",
  },
  {
    q: "Je peux créer mes propres scénarios ?",
    a: "Absolument. Dans la section Créer, tu peux concevoir un scénario sur mesure : choisis un personnage, rédige ses répliques, définis le contexte. Tu peux le laisser en privé ou le publier pour la communauté.",
  },
  {
    q: "Comment signaler un abus ?",
    a: "Tu peux signaler un scénario, un commentaire ou un utilisateur via les options de signalement présentes sur chaque contenu. Notre équipe de modération examine chaque signalement.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Aide & FAQ
        </h1>
        <p className="text-muted-foreground max-w-xl">
          Tout ce qu&apos;il faut savoir pour plonger dans le chaos EchoRoom.
          Pas de jargon, pas de blabla — juste les réponses.
        </p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <details
            key={i}
            className="group rounded-xl border border-border bg-card transition-colors duration-200 open:border-primary/30"
          >
            <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium list-none">
              {faq.q}
              <span className="shrink-0 ml-4 text-muted-foreground transition-transform duration-200 group-open:rotate-45">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            </summary>
            <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
              {faq.a}
            </div>
          </details>
        ))}
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-6 text-center">
        <p className="text-sm font-medium mb-2">Besoin d&apos;aide supplémentaire ?</p>
        <p className="text-sm text-muted-foreground">
          Rejoins notre{" "}
          <Link href="/community" className="text-primary hover:underline">
            communauté Discord
          </Link>{" "}
          ou explore les{" "}
          <Link href="/explore" className="text-primary hover:underline">
            scénarios tendance
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
