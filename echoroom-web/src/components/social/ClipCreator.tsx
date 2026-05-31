"use client"

import { useState } from "react"
import { Input, Button } from "@/components/ui"
import { Scissors } from "lucide-react"
import { api } from "@/lib/trpc"
import { toast } from "@/components/ui"

interface ClipCreatorProps {
  callId: string
  durationSeconds: number
}

export function ClipCreator({ callId, durationSeconds }: ClipCreatorProps) {
  const [title, setTitle] = useState("")
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(durationSeconds)

  const createMutation = api.social.createClip.useMutation({
    onSuccess: () => {
      toast({
        title: "Clip créé !",
        variant: "default",
      })
      setTitle("")
      setStartTime(0)
      setEndTime(durationSeconds)
    },
    onError: (err) => {
      toast({
        title: err.message || "Erreur lors de la création du clip",
        variant: "destructive",
      })
    },
  })

  const isValid =
    startTime >= 0 &&
    endTime > startTime &&
    endTime <= durationSeconds

  function handleSubmit() {
    if (!isValid) return
    createMutation.mutate({
      callId,
      title: title.trim() || undefined,
      startTime,
      endTime,
    })
  }

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Scissors className="w-4 h-4 text-primary" />
        <span>Créer un clip</span>
      </div>

      <div>
        <label
          htmlFor="clip-title"
          className="block text-xs text-muted-foreground mb-1"
        >
          Titre (optionnel)
        </label>
        <Input
          id="clip-title"
          placeholder="Clip"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          className="text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="clip-start"
            className="block text-xs text-muted-foreground mb-1"
          >
            Début (secondes)
          </label>
          <Input
            id="clip-start"
            type="number"
            min={0}
            max={durationSeconds}
            value={startTime}
            onChange={(e) => setStartTime(Math.max(0, Number(e.target.value)))}
            className="text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="clip-end"
            className="block text-xs text-muted-foreground mb-1"
          >
            Fin (secondes)
          </label>
          <Input
            id="clip-end"
            type="number"
            min={0}
            max={durationSeconds}
            value={endTime}
            onChange={(e) =>
              setEndTime(
                Math.min(durationSeconds, Math.max(0, Number(e.target.value))),
              )
            }
            className="text-sm"
          />
        </div>
      </div>

      {!isValid && (startTime > 0 || endTime > 0) && (
        <p className="text-xs text-destructive">
          La fin doit être après le début et dans la durée de l&apos;appel
        </p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!isValid || createMutation.isPending}
        className="w-full gap-2"
        size="sm"
      >
        {createMutation.isPending ? "Création..." : "Créer le clip"}
      </Button>
    </div>
  )
}
