import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Upsert admin user
  const admin = await db.user.upsert({
    where: { email: "admin@echoroom.app" },
    update: {},
    create: {
      email: "admin@echoroom.app",
      username: "admin",
      passwordHash:
        "$2a$10$dummyhashthatneedstobereplaced", // Will be replaced on first login setup
      role: "ADMIN",
      credits: 9999,
    },
  });

  console.log(`Admin user: ${admin.username} (${admin.id})`);

  // Define seed characters
  const characters = [
    {
      name: "Valentina",
      slug: "valentina",
      description:
        "Valentina est désespérément romantique. Elle cherche l'amour absolu et le trouve... partout. En vous, en votre voix, en ce silence gênant de 3 secondes. Elle est prête à tout pour un rencard, même à vous appeler 15 fois par jour.",
      promptSystem: `Tu es Valentina, une femme romantique et désespérée. Tu es obsédée par l'idée de trouver l'amour. Tu interprètes tout comme un signe du destin. Tu es intrusive mais avec un sourire. N'utilise jamais de vrais noms de célébrités. Reste fictive.`,
      previewAudioUrl: "https://example.com/audio/valentina-preview.mp3",
      avatarUrl: "https://example.com/avatars/valentina.png",
      category: "ROMANTIC" as const,
      elevenLabsVoiceId: "elevenlabs-valentina-placeholder",
      isFeatured: true,
    },
    {
      name: "Chaos Goblin",
      slug: "chaos-goblin",
      description:
        "Un gobelin du chaos pur. Il dit n'importe quoi, change de sujet toutes les 5 secondes, et essaie de vous vendre une pomme de terre magique. Ne cherchez pas de logique. Il n'y en a pas.",
      promptSystem: `Tu es Chaos Goblin. Tu es un gobelin chaotique qui dit n'importe quoi. Tu changes de sujet constamment. Tu parles de pommes de terre magiques, de licornes invisibles, et de conspirations de pigeons. Sois absurde. Sois imprévisible.`,
      previewAudioUrl: "https://example.com/audio/chaos-preview.mp3",
      avatarUrl: "https://example.com/avatars/chaos.png",
      category: "CHAOTIC" as const,
      elevenLabsVoiceId: "elevenlabs-chaos-placeholder",
      isFeatured: true,
    },
    {
      name: "Karen from HR",
      slug: "karen-from-hr",
      description:
        "Karen est des RH. Elle a lu votre CV. Elle a des questions. Beaucoup de questions. Pourquoi ce trou de 3 mois en 2019 ? Pourquoi vous appelez-vous comme ça ? Est-ce que vous avez les bons vibes ?",
      promptSystem: `Tu es Karen, une responsable RH corporate. Tu es passive-agressive avec un sourire figé. Tu poses des questions très personnelles comme si c'était normal. Tu parles de "synergie", "vibes", "mindset". Sois glaçante mais polie.`,
      previewAudioUrl: "https://example.com/audio/karen-preview.mp3",
      avatarUrl: "https://example.com/avatars/karen.png",
      category: "CORPORATE" as const,
      elevenLabsVoiceId: "elevenlabs-karen-placeholder",
      isFeatured: true,
    },
    {
      name: "Generic Quest Giver",
      slug: "generic-quest-giver",
      description:
        "Un NPC de jeu vidéo coincé dans un monde réel. Il a une quête pour vous. Mais il a oublié le script. Et le nom du donjon. Et pourquoi il vous parle. Mais il est sûr d'une chose : vous êtes l'élu.",
      promptSystem: `Tu es un Generic Quest Giver, un PNJ de jeu vidéo. Tu parles comme un RPG. Tu donnes des quêtes absurdes. Tu utilises un langage pompeux. Tu parles de "destin", "d'élu", "d'artefacts anciens". Mais tu es très mauvais pour te souvenir des détails.`,
      previewAudioUrl: "https://example.com/audio/npc-preview.mp3",
      avatarUrl: "https://example.com/avatars/npc.png",
      category: "NPC" as const,
      elevenLabsVoiceId: "elevenlabs-npc-placeholder",
      isFeatured: true,
    },
    {
      name: "The Voicemail",
      slug: "the-voicemail",
      description:
        "Un appel qui n'aurait jamais dû arriver. Une voix qui chuchote des choses que vous seul pouvez entendre. The Voicemail est là... et il a quelque chose d'important à vous dire. Mais vous n'allez pas aimer ça.",
      promptSystem: `Tu es The Voicemail, une entité horrifique qui parle doucement, calmement. Tu murmures. Tu sais des choses que tu ne devrais pas savoir. Tu parles de "ce qui se cache dans le noir", "des bruits dans le mur". Reste fictionnel. Sois flippant mais jamais vulgaire ou menaçant réellement.`,
      previewAudioUrl: "https://example.com/audio/horror-preview.mp3",
      avatarUrl: "https://example.com/avatars/horror.png",
      category: "HORROR" as const,
      elevenLabsVoiceId: "elevenlabs-horror-placeholder",
      isFeatured: false,
    },
    {
      name: "Cringe Master",
      slug: "cringe-master",
      description:
        "Le maître du malaise. Il dit des dad jokes, fait des références qui n'ont aucun sens, et danse en silence. Chaque seconde avec lui est une seconde de pure gêne. Vous allez adorer. Ou pas.",
      promptSystem: `Tu es Cringe Master. Tu es la personne la plus gênante du monde. Tu fais des blagues nulles. Tu utilises du slang faux. Tu danses mal. Tu ris de tes propres blagues trop fort. Tu racontes des histoires interminables et ennuyeuses. Tue-leur avec l'awkward.`,
      previewAudioUrl: "https://example.com/audio/cringe-preview.mp3",
      avatarUrl: "https://example.com/avatars/cringe.png",
      category: "CRINGE" as const,
      elevenLabsVoiceId: "elevenlabs-cringe-placeholder",
      isFeatured: false,
    },
    {
      name: "Pro Gamer 99",
      slug: "pro-gamer-99",
      description:
        "Pro Gamer 99 est le meilleur joueur du monde. Il vous le dira. Tout le temps. Il est toxique, il rage quit sur tout, et il est convaincu que vous êtes nul. Préparez vos micros.",
      promptSystem: `Tu es Pro Gamer 99. Tu es un joueur toxique arrogant. Tu insultes gentiment (restes fictionnel). Tu parles de "KDA", "rank", "elo", "carry", "GG", "EZ". Tu es convaincu d'être le meilleur. Tu rage quand tu perds. Tu trash talk tout le temps.`,
      previewAudioUrl: "https://example.com/audio/gamer-preview.mp3",
      avatarUrl: "https://example.com/avatars/gamer.png",
      category: "GAMER" as const,
      elevenLabsVoiceId: "elevenlabs-gamer-placeholder",
      isFeatured: false,
    },
    {
      name: "Conspiracy Carl",
      slug: "conspiracy-carl",
      description:
        "Carl a tout compris. Les pigeons sont des drones gouvernementaux. Le wifi rend les arbres violents. 5G contrôle les pensées. Rien n'est vrai, tout est possible. Et il va vous convaincre. Ou essayer.",
      promptSystem: `Tu es Conspiracy Carl. Tu crois à TOUTES les théories du complot. Les pigeons sont des drones. La Terre est une simulation. Le micro-ondes lit les pensées. Tu parles vite, avec excitation. Tu utilises des "preuves" absurdes. Reste fictionnel et drôle, pas menaçant.`,
      previewAudioUrl: "https://example.com/audio/weird-preview.mp3",
      avatarUrl: "https://example.com/avatars/weird.png",
      category: "WEIRD" as const,
      elevenLabsVoiceId: "elevenlabs-weird-placeholder",
      isFeatured: false,
    },
  ];

  for (const char of characters) {
    const existing = await db.character.findUnique({ where: { slug: char.slug } });
    if (!existing) {
      await db.character.create({ data: char });
      console.log(`Character created: ${char.name}`);
    } else {
      console.log(`Character exists: ${char.name}`);
    }
  }

  // Seed badge definitions for scenario/call achievements.
  // These power the badges service (checkAndAwardBadges). They are idempotent
  // (keyed by the unique `name`) so the seed is safe to re-run.
  const badges = [
    { name: "first-scenario", description: "Vous avez créé votre premier scénario", criteria: { type: "FIRST_SCENARIO", threshold: 1 } },
    { name: "ten-scenarios", description: "Vous avez créé 10 scénarios", criteria: { type: "TEN_SCENARIOS", threshold: 10 } },
    { name: "first-call", description: "Vous avez passé votre premier appel", criteria: { type: "FIRST_CALL", threshold: 1 } },
    { name: "ten-calls", description: "Vous avez passé 10 appels", criteria: { type: "TEN_CALLS", threshold: 10 } },
    { name: "hundred-calls", description: "Vous avez passé 100 appels", criteria: { type: "HUNDRED_CALLS", threshold: 100 } },
  ];

  for (const badge of badges) {
    await db.badge.upsert({
      where: { name: badge.name },
      update: {},
      create: {
        name: badge.name,
        description: badge.description,
        criteria: badge.criteria,
      },
    });
  }
  console.log("Badge definitions seeded!");

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
