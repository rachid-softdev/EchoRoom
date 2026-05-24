export default function EchoRoomLanding() {
  const scenarios = [
    {
      title: 'Fake Recruiter Simulator',
      description: 'Un recruteur IA totalement absurde qui transforme chaque entretien en chaos social.',
    },
    {
      title: 'NPC Customer Support',
      description: 'Le support client le plus inutile de l’univers. Plus tu expliques, pire ça devient.',
    },
    {
      title: 'AI Ex Girlfriend Chaos',
      description: 'Une conversation émotionnellement catastrophique générée en temps réel.',
    },
  ];

  const features = [
    'Appels IA interactifs en temps réel',
    'Personnages fictifs viraux',
    'Feed communautaire & replays',
    'Rooms multijoueurs Discord/TikTok',
    'Scénarios générés par IA',
    'Clips partageables instantanément',
  ];

  return (
    <main className="min-h-screen bg-black text-white overflow-hidden">
      <section className="relative border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/20 via-transparent to-transparent" />

        <div className="max-w-7xl mx-auto px-6 py-24 lg:py-32 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm mb-6 backdrop-blur">
                ⚡ AI Social Chaos Platform
              </div>

              <h1 className="text-5xl lg:text-7xl font-black leading-[0.95] tracking-tight">
                Les appels IA
                <span className="block text-cyan-400">que tout TikTok va partager.</span>
              </h1>

              <p className="mt-8 text-xl text-white/70 leading-relaxed max-w-xl">
                Crée des conversations absurdes, lance des appels immersifs avec des personnages IA,
                écoute les réactions en direct et transforme chaque moment en contenu viral.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <button className="rounded-2xl bg-cyan-500 hover:bg-cyan-400 transition px-8 py-4 text-lg font-semibold shadow-2xl shadow-cyan-500/20">
                  Commencer gratuitement
                </button>

                <button className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-8 py-4 text-lg font-semibold backdrop-blur">
                  Voir une démo
                </button>
              </div>

              <div className="mt-10 flex items-center gap-8 text-white/60 text-sm">
                <div>
                  <div className="text-2xl font-bold text-white">1M+</div>
                  appels générés
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">250k+</div>
                  clips partagés
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">24/7</div>
                  chaos communautaire
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-10 bg-cyan-500/20 blur-3xl rounded-full" />

              <div className="relative rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="font-semibold">LIVE CALL</p>
                    <p className="text-sm text-white/50">Scenario #0281</p>
                  </div>

                  <div className="flex items-center gap-2 rounded-full bg-red-500/20 text-red-300 px-3 py-1 text-sm">
                    <div className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                    LIVE
                  </div>
                </div>

                <div className="space-y-4 mt-6">
                  <div className="rounded-2xl bg-cyan-500/10 border border-cyan-500/20 p-4">
                    <p className="text-sm text-cyan-300 mb-2">AI Character</p>
                    <p className="text-lg font-medium">
                      “Bonjour. Votre CV est excellent mais… pourquoi avez-vous 47 expériences comme magicien ?”
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <p className="text-sm text-white/50 mb-2">User</p>
                    <p className="text-lg">
                      “C’était principalement des incidents Discord.”
                    </p>
                  </div>

                  <div className="rounded-2xl bg-cyan-500/10 border border-cyan-500/20 p-4">
                    <p className="text-sm text-cyan-300 mb-2">AI Character</p>
                    <p className="text-lg font-medium">
                      “Très bien. Vous êtes immédiatement promu Directeur du Chaos.”
                    </p>
                  </div>
                </div>

                <div className="mt-8 rounded-2xl bg-black/40 border border-white/10 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/50">Audience Room</p>
                    <p className="font-semibold">2,481 personnes écoutent</p>
                  </div>

                  <button className="rounded-xl bg-white text-black px-4 py-2 font-semibold hover:opacity-90 transition">
                    Rejoindre
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-cyan-400 font-semibold uppercase tracking-widest">
            Pourquoi ça devient viral
          </p>

          <h2 className="mt-4 text-4xl lg:text-6xl font-black leading-tight">
            Plus qu’un prank call.
            <span className="block text-white/60">Un jeu social IA.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
          {features.map((feature) => (
            <div
              key={feature}
              className="rounded-3xl border border-white/10 bg-white/5 p-8 hover:bg-white/10 transition"
            >
              <div className="h-12 w-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-2xl mb-6">
                ⚡
              </div>

              <p className="text-xl font-semibold leading-snug">{feature}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03]">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="flex items-end justify-between flex-wrap gap-6">
            <div>
              <p className="text-cyan-400 font-semibold uppercase tracking-widest">
                Trending Scenarios
              </p>

              <h2 className="mt-4 text-4xl font-black">
                Les scénarios qui explosent.
              </h2>
            </div>

            <button className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-semibold hover:bg-white/10 transition">
              Explorer le feed
            </button>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mt-14">
            {scenarios.map((scenario) => (
              <div
                key={scenario.title}
                className="rounded-[28px] border border-white/10 bg-black/40 overflow-hidden hover:-translate-y-1 transition duration-300"
              >
                <div className="h-56 bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 flex items-center justify-center text-7xl">
                  🎭
                </div>

                <div className="p-8">
                  <div className="flex items-center justify-between mb-4 text-sm text-white/50">
                    <span>🔥 Trending</span>
                    <span>128k plays</span>
                  </div>

                  <h3 className="text-2xl font-bold leading-tight">
                    {scenario.title}
                  </h3>

                  <p className="mt-4 text-white/60 leading-relaxed">
                    {scenario.description}
                  </p>

                  <button className="mt-8 rounded-xl bg-white text-black px-5 py-3 font-semibold hover:opacity-90 transition w-full">
                    Lancer ce scénario
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="rounded-[40px] border border-white/10 bg-gradient-to-b from-cyan-500/20 to-transparent p-12 lg:p-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_50%)]" />

          <div className="relative z-10">
            <p className="uppercase tracking-[0.3em] text-sm text-cyan-300 font-semibold">
              AI PARTY PLATFORM
            </p>

            <h2 className="mt-6 text-5xl lg:text-7xl font-black leading-[0.95] max-w-4xl mx-auto">
              Le futur des conversations sociales IA.
            </h2>

            <p className="mt-8 text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
              Crée des moments impossibles. Lance des appels absurdes. Fais réagir internet.
            </p>

            <div className="mt-12 flex flex-col sm:flex-row justify-center gap-4">
              <button className="rounded-2xl bg-white text-black px-8 py-4 text-lg font-bold hover:opacity-90 transition">
                Créer mon premier call
              </button>

              <button className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-lg font-bold hover:bg-white/10 transition">
                Rejoindre la communauté
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
