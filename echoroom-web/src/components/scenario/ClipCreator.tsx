"use client";

import { useCallback, useState } from "react";
import { Button, Input, Skeleton, toast } from "@echoroom/ui";
import { api } from "@/lib/trpc";

interface ClipCreatorProps {
  scenarioId: string;
}

export function ClipCreator({ scenarioId }: ClipCreatorProps) {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [clipStartTime, setClipStartTime] = useState(0);
  const [clipEndTime, setClipEndTime] = useState(30);
  const [clipTitle, setClipTitle] = useState("");

  const callsQuery = api.calls.listByScenario.useQuery({ scenarioId, limit: 20 });

  const selectedCall = callsQuery.data?.items?.find((c) => c.id === selectedCallId);
  const maxDuration = selectedCall?.durationSeconds ?? 0;

  const createClipMutation = api.clips.create.useMutation({
    onSuccess: () => {
      toast({
        title: "Clip créé",
        message: "L'extraction audio a commencé en arrière-plan.",
        variant: "default",
      });
      setSelectedCallId(null);
      setClipStartTime(0);
      setClipEndTime(30);
      setClipTitle("");
    },
    onError: (err) => {
      toast({
        title: err.message ?? "Erreur lors de la création du clip",
        variant: "destructive",
      });
    },
  });

  const handleCreateClip = useCallback(() => {
    if (!selectedCallId) return;
    createClipMutation.mutate({
      callId: selectedCallId,
      startTime: clipStartTime,
      endTime: clipEndTime,
      title: clipTitle || undefined,
    });
  }, [selectedCallId, clipStartTime, clipEndTime, clipTitle, createClipMutation]);

  const canCreate =
    selectedCallId &&
    clipEndTime > clipStartTime &&
    clipEndTime <= maxDuration &&
    !createClipMutation.isPending;

  return (
    <div className="rounded-xl border border-border/50 p-6 space-y-4">
      <h3 className="font-semibold">Créer un clip</h3>

      {callsQuery.isLoading ? (
        <Skeleton className="h-24" />
      ) : (callsQuery.data?.items ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun appel avec enregistrement trouvé pour ce scénario
        </p>
      ) : (
        <>
          {/* Call selector */}
          <div className="space-y-2">
            <label htmlFor="call-select" className="text-sm font-medium">
              Appel
            </label>
            <select
              id="call-select"
              value={selectedCallId ?? ""}
              onChange={(e) => {
                setSelectedCallId(e.target.value || null);
                setClipStartTime(0);
                setClipEndTime(30);
              }}
              className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm"
              aria-describedby="clip-call-hint"
            >
              <option value="">Sélectionner un appel</option>
              {callsQuery.data?.items.map((call) => (
                <option key={call.id} value={call.id}>
                  {new Date(call.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  — {call.durationSeconds}s
                </option>
              ))}
            </select>
            <p id="clip-call-hint" className="text-xs text-muted-foreground">
              {maxDuration > 0
                ? `Durée max : ${Math.floor(maxDuration / 60)}:${(maxDuration % 60).toString().padStart(2, "0")}`
                : "Sélectionnez un appel pour définir les temps"}
            </p>
          </div>

          {/* Start / End time inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="clip-start" className="text-sm font-medium">
                Début (s)
              </label>
              <Input
                id="clip-start"
                type="number"
                min={0}
                max={maxDuration > 0 ? maxDuration - 1 : undefined}
                value={clipStartTime}
                onChange={(e) =>
                  setClipStartTime(Math.max(0, Math.min(Number(e.target.value), maxDuration - 1)))
                }
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="clip-end" className="text-sm font-medium">
                Fin (s)
              </label>
              <Input
                id="clip-end"
                type="number"
                min={1}
                max={maxDuration > 0 ? maxDuration : undefined}
                value={clipEndTime}
                onChange={(e) =>
                  setClipEndTime(Math.max(1, Math.min(Number(e.target.value), maxDuration)))
                }
                placeholder="30"
              />
            </div>
          </div>

          {selectedCallId && clipEndTime > maxDuration && (
            <p className="text-xs text-destructive" role="alert">
              La fin du clip dépasse la durée de l&apos;appel ({maxDuration}s)
            </p>
          )}

          {/* Title input */}
          <div className="space-y-2">
            <label htmlFor="clip-title" className="text-sm font-medium">
              Titre (optionnel)
            </label>
            <Input
              id="clip-title"
              value={clipTitle}
              onChange={(e) => setClipTitle(e.target.value)}
              placeholder="Mon clip"
            />
          </div>

          {/* Create button */}
          <Button onClick={handleCreateClip} disabled={!canCreate} className="w-full gap-2">
            {createClipMutation.isPending ? "Création en cours..." : "Créer le clip"}
          </Button>

          {createClipMutation.data && (
            <p className="text-xs text-green-600">
              Clip créé avec succès — l&apos;extraction est lancée en arrière-plan.
            </p>
          )}
        </>
      )}
    </div>
  );
}
