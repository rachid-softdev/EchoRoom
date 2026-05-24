"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui";
import { Badge } from "@/components/ui";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/trpc";
import { DataLoader } from "@/components/shared/DataLoader";
import { useApiToast } from "@/lib/trpc-error";

const CATEGORY_LABELS: Record<string, string> = {
  ROMANTIC: "Romantique",
  CHAOTIC: "Chaotique",
  CORPORATE: "Corporate",
  NPC: "NPC",
  HORROR: "Horreur",
  CRINGE: "Cringe",
  GAMER: "Gamer",
  WEIRD: "Weird",
};

export default function CreatePage() {
  const router = useRouter();
  const charactersQuery = api.characters.list.useQuery();
  const createScenario = useApiToast(api.scenarios.create.useMutation(), {
    success: "Scénario créé !",
    onSuccess: () => router.push("/dashboard"),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [openingMessage, setOpeningMessage] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [selectedCharacter, setSelectedCharacter] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">("PUBLIC");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    createScenario.mutate({
      characterId: selectedCharacter,
      title,
      description,
      openingMessage,
      aiInstructions,
      visibility,
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            Annuler
          </Button>
        </Link>
      </nav>

      <section className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Créer un scénario</h1>
          <p className="text-muted-foreground">
            Définissez le personnage, le contexte et les instructions IA
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Character selection */}
          <div>
            <p className="text-sm font-medium mb-3 block">
              Personnage IA
            </p>
            <DataLoader
              query={charactersQuery}
              isEmpty={(data) => data.length === 0}
              skeletonCount={4}
            >
              {(characters) => (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {characters.map((char) => (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => setSelectedCharacter(char.id)}
                      className={`p-4 rounded-xl border text-left transition-colors ${
                        selectedCharacter === char.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-border/80"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                      <p className="font-medium text-sm">{char.name}</p>
                      <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
                        {CATEGORY_LABELS[char.category] ?? char.category}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </DataLoader>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Titre du scénario
            </label>
            <Input
              id="title"
              placeholder="Ex: Le speed dating catastrophique"
              required
              minLength={3}
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              className="flex w-full rounded-xl border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[80px] resize-y"
              placeholder="Décrivez le contexte du scénario..."
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Opening message */}
          <div className="space-y-2">
            <label htmlFor="openingMessage" className="text-sm font-medium">
              Message d&apos;ouverture
            </label>
            <textarea
              id="openingMessage"
              className="flex w-full rounded-xl border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[80px] resize-y"
              placeholder="Ce que le personnage dit au début de l'appel..."
              maxLength={300}
              value={openingMessage}
              onChange={(e) => setOpeningMessage(e.target.value)}
            />
          </div>

          {/* AI Instructions */}
          <div className="space-y-2">
            <label htmlFor="aiInstructions" className="text-sm font-medium">
              Instructions IA
            </label>
            <textarea
              id="aiInstructions"
              className="flex w-full rounded-xl border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[120px] resize-y"
              placeholder="Instructions détaillées pour le comportement de l'IA..."
              maxLength={3000}
              value={aiInstructions}
              onChange={(e) => setAiInstructions(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {aiInstructions.length}/3000 caractères
            </p>
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Visibilité</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVisibility("PUBLIC")}
                className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                  visibility === "PUBLIC"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Public
              </button>
              <button
                type="button"
                onClick={() => setVisibility("PRIVATE")}
                className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                  visibility === "PRIVATE"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Privé
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={createScenario.isPending || selectedCharacter === ""}>
            {createScenario.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Créer le scénario
              </>
            )}
          </Button>
        </form>
      </section>
    </div>
  );
}
