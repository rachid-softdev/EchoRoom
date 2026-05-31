"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui";
import { Skeleton } from "@/components/ui";
import { User, Download, Trash2, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { api } from "@/lib/trpc";
import { toast } from "@/components/ui";
import { signOut } from "next-auth/react";

export default function SettingsPageClient() {
  const { data: session } = useSession();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const updateProfile = api.user.updateProfile.useMutation({
    onSuccess: () => {
      toast({ title: "Profil mis à jour", variant: "success" });
      setHasChanges(false);
    },
    onError: (err) => {
      toast({ title: err.message ?? "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/user/export", {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Erreur ${res.status}`);
      }

      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `echoroom-export-${data.user?.id?.substring(0, 8) ?? "data"}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Export réussi", variant: "success" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de l'export";
      toast({ title: message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const deleteMutation = api.user.deleteMyAccount.useMutation({
    onSuccess: () => {
      toast({
        title: "Compte supprimé",
        variant: "success",
      });
      signOut({ callbackUrl: "/" });
    },
    onError: (err) => {
      toast({
        title: err.message ?? "Erreur lors de la suppression",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (session?.user) {
      setUsername(session.user.username ?? "");
      setEmail(session.user.email ?? "");
    }
  }, [session]);

  return (
    <DashboardShell title="Paramètres">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>Profil</CardTitle>
              <CardDescription>Gérez vos informations personnelles</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">
              Nom d&apos;utilisateur
            </label>
            <Input
              id="username"
              placeholder="Votre pseudo"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setHasChanges(true);
              }}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => updateProfile.mutate({ username })}
              disabled={!hasChanges || updateProfile.isPending}
              className="gap-2"
            >
              {updateProfile.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Enregistrer"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Apparence</CardTitle>
          <CardDescription>Personnalisez votre expérience</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Thème sombre activé par défaut.
          </p>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/50 mt-6">
        <CardHeader>
          <CardTitle className="text-destructive">Zone de danger</CardTitle>
          <CardDescription>Actions irréversibles sur votre compte</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium text-sm">Exporter mes données</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Téléchargez une copie de toutes vos données personnelles (format JSON)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Export..." : "Exporter"}
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium text-sm">Supprimer mon compte</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Supprimez définitivement votre compte et toutes vos données
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => {
                setDeleteConfirmation("")
                setDeleteDialogOpen(true)
              }}
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) setDeleteConfirmation("")
        }}
        title="Supprimer votre compte"
        description={
          <div className="space-y-3">
            <p>Cette action est irréversible. Toutes vos données personnelles seront anonymisées.</p>
            <div className="space-y-2">
              <label htmlFor="delete-confirm" className="text-sm font-medium">
                Tapez <strong>SUPPRIMER</strong> pour confirmer
              </label>
              <Input
                id="delete-confirm"
                placeholder="SUPPRIMER"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
              />
            </div>
          </div>
        }
        confirmLabel="Supprimer définitivement"
        variant="destructive"
        confirmDisabled={deleteConfirmation !== "SUPPRIMER"}
        onConfirm={() => {
          deleteMutation.mutate({ confirmation: "SUPPRIMER" })
        }}
        loading={deleteMutation.isPending}
      />
    </DashboardShell>
  );
}
