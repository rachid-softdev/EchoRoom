"use client"

import { useState } from "react"
import { Flag } from "lucide-react"
import { Button } from "@/components/ui"
import { Textarea } from "@/components/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui"
import { toast } from "@/components/ui"
import { api } from "@/lib/trpc"
import { MIN_REPORT_REASON_LENGTH } from "@/lib/constants"

interface ReportButtonProps {
  targetType: "SCENARIO" | "COMMENT" | "USER"
  targetId: string
  variant?: "icon" | "text"
}

export function ReportButton({
  targetType,
  targetId,
  variant = "icon",
}: ReportButtonProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const reportMutation = api.community.reportAbuse.useMutation({
    onSuccess: () => {
      toast({
        title: "Signalement envoyé",
        variant: "success",
      })
      setOpen(false)
      setReason("")
    },
    onError: (err) => {
      toast({
        title: err.message ?? "Erreur lors de l'envoi du signalement",
        variant: "destructive",
      })
    },
  })

  function handleSubmit() {
    if (reason.trim().length < MIN_REPORT_REASON_LENGTH) return
    reportMutation.mutate({
      targetType,
      targetId,
      reason: reason.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
            <Flag className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive">
            <Flag className="w-4 h-4" />
            Signaler
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signaler un contenu</DialogTitle>
          <DialogDescription>
            Ce signalement sera examiné par notre équipe de modération.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Textarea
            placeholder="Expliquez le problème (minimum 10 caractères)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            {reason.length >= MIN_REPORT_REASON_LENGTH
              ? "Signalement prêt à être envoyé"
              : `${MIN_REPORT_REASON_LENGTH - reason.length} caractères minimum requis`}
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false)
              setReason("")
            }}
            disabled={reportMutation.isPending}
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={reason.trim().length < MIN_REPORT_REASON_LENGTH || reportMutation.isPending}
          >
            {reportMutation.isPending ? "Envoi..." : "Signaler"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
