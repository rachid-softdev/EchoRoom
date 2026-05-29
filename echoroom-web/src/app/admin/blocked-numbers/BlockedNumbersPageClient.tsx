"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui"
import { Button } from "@/components/ui"
import { Input } from "@/components/ui"
import { DataLoader } from "@/components/shared/DataLoader"
import { api } from "@/lib/trpc"
import { toast } from "@/components/ui"
import { Ban, Unlock, PhoneOff } from "lucide-react"

export default function BlockedNumbersPageClient() {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [reason, setReason] = useState("")

  const blockedQuery = api.admin.getBlockedNumbers.useQuery()
  const blockMutation = api.admin.blockNumber.useMutation({
    onSuccess: () => {
      toast({ title: "Numéro bloqué", variant: "success" })
      setPhoneNumber("")
      setReason("")
      blockedQuery.refetch()
    },
    onError: (err) => {
      toast({
        title: err.message ?? "Erreur lors du blocage",
        variant: "destructive",
      })
    },
  })

  const unblockMutation = api.admin.unblockNumber.useMutation({
    onSuccess: () => {
      toast({ title: "Numéro débloqué", variant: "success" })
      blockedQuery.refetch()
    },
    onError: (err) => {
      toast({
        title: err.message ?? "Erreur lors du déblocage",
        variant: "destructive",
      })
    },
  })

  function handleBlock(e: React.FormEvent) {
    e.preventDefault()
    if (!phoneNumber.trim()) return
    blockMutation.mutate({
      phoneNumber: phoneNumber.trim(),
      reason: reason.trim() || undefined,
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Numéros bloqués</h1>
          <p className="text-muted-foreground mt-1">
            Gérez la liste des numéros de téléphone bloqués
          </p>
        </div>
      </div>

      {/* Block form */}
      <Card className="border-border/50 mb-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-destructive" />
            <div>
              <CardTitle>Bloquer un numéro</CardTitle>
              <CardDescription>
                Ajoutez un numéro à la liste de blocage
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBlock} className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="+33612345678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="sm:max-w-xs"
              required
            />
            <Input
              placeholder="Motif (optionnel)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="sm:max-w-sm"
            />
            <Button
              type="submit"
              variant="destructive"
              className="gap-2 shrink-0"
              disabled={!phoneNumber.trim() || blockMutation.isPending}
            >
              <Ban className="w-4 h-4" />
              Bloquer
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Blocked numbers list */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Numéros bloqués</CardTitle>
        </CardHeader>
        <CardContent>
          <DataLoader
            query={blockedQuery}
            isEmpty={(data) => data.items.length === 0}
            empty={
              <div className="py-12 text-center">
                <PhoneOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Aucun numéro bloqué pour le moment.
                </p>
              </div>
            }
          >
            {(data) => (
              <div className="space-y-3">
                {data.items.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-medium">
                        {entry.phoneNumber}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {entry.reason ? (
                          <>Motif : {entry.reason} — </> 
                        ) : null}
                        Bloqué par {entry.blockedBy?.username ?? "inconnu"} le{" "}
                        {new Date(entry.createdAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-muted-foreground hover:text-green-500 shrink-0"
                      onClick={() => unblockMutation.mutate({ id: entry.id })}
                      disabled={unblockMutation.isPending}
                    >
                      <Unlock className="w-4 h-4" />
                      Débloquer
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DataLoader>
        </CardContent>
      </Card>
    </div>
  )
}
