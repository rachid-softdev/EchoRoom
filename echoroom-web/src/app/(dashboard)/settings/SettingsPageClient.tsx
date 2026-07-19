"use client";

import { Download, Loader2, Lock, ShieldX, Trash2, User } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DashboardShell } from "@/components/shared/DashboardShell";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  toast,
} from "@echoroom/ui";
import { api } from "@/lib/trpc";
import { useApiToast } from "@/lib/trpc-error";

export default function SettingsPageClient() {
  const { data: session } = useSession();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [consentConfirmation, setConsentConfirmation] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const originalUsername = useRef("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateProfile = api.profile.updateProfile.useMutation({
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
      const message = err instanceof Error ? err.message : "Erreur lors de l'export";
      toast({ title: message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const deleteMutation = api.profile.deleteMyAccount.useMutation({
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

  const withdrawConsentMutation = api.user.withdrawConsent.useMutation({
    onSuccess: () => {
      toast({
        title: "Consentement retiré",
        message: "Vos données personnelles ont été anonymisées.",
        variant: "success",
      });
      signOut({ callbackUrl: "/" });
    },
    onError: (err) => {
      toast({
        title: err.message ?? "Erreur lors du retrait du consentement",
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useApiToast(api.auth.changePassword.useMutation(), {
    success: "Mot de passe modifié avec succès",
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
  });

  useEffect(() => {
    if (session?.user) {
      setUsername(session.user.username ?? "");
      setEmail(session.user.email ?? "");
      originalUsername.current = session.user.username ?? "";
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
                const newValue = e.target.value;
                setUsername(newValue);
                setHasChanges(newValue !== originalUsername.current);
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

      {/* Password change */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>Mot de passe</CardTitle>
              <CardDescription>Changez votre mot de passe</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="currentPassword" className="text-sm font-medium">
              Mot de passe actuel
            </label>
            <Input
              id="currentPassword"
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="newPassword" className="text-sm font-medium">
              Nouveau mot de passe
            </label>
            <Input
              id="newPassword"
              type="password"
              placeholder="8 caractères minimum"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirmer le nouveau mot de passe
            </label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Retapez le nouveau mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={() =>
                changePasswordMutation.mutate({
                  currentPassword,
                  newPassword,
                })
              }
              disabled={
                !currentPassword ||
                !newPassword ||
                !confirmPassword ||
                newPassword !== confirmPassword ||
                newPassword.length < 8 ||
                changePasswordMutation.isPending
              }
              className="gap-2"
            >
              {changePasswordMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Changer le mot de passe"
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
          <p className="text-sm text-muted-foreground">Thème sombre activé par défaut.</p>
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
              <p className="font-medium text-sm">Retirer le consentement</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Anonymisez vos données personnelles (RGPD Art. 7)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                setConsentConfirmation("");
                setConsentDialogOpen(true);
              }}
            >
              <ShieldX className="w-4 h-4" />
              Retirer
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
                setDeleteConfirmation("");
                setDeleteDialogOpen(true);
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
          setDeleteDialogOpen(open);
          if (!open) setDeleteConfirmation("");
        }}
        title="Supprimer votre compte"
        description={
          <div className="space-y-3">
            <p>
              Cette action est irréversible. Toutes vos données personnelles seront anonymisées.
            </p>
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
          deleteMutation.mutate({ confirmation: "SUPPRIMER" });
        }}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={consentDialogOpen}
        onOpenChange={(open) => {
          setConsentDialogOpen(open);
          if (!open) setConsentConfirmation("");
        }}
        title="Retirer le consentement"
        description={
          <div className="space-y-3">
            <p>
              Vos données personnelles seront anonymisées conformément au RGPD (Art. 7). Cette
              action est réversible via un nouveau consentement.
            </p>
            <div className="space-y-2">
              <label htmlFor="consent-confirm" className="text-sm font-medium">
                Tapez <strong>RETIRER</strong> pour confirmer
              </label>
              <Input
                id="consent-confirm"
                placeholder="RETIRER"
                value={consentConfirmation}
                onChange={(e) => setConsentConfirmation(e.target.value)}
              />
            </div>
          </div>
        }
        confirmLabel="Retirer définitivement"
        variant="destructive"
        confirmDisabled={consentConfirmation !== "RETIRER"}
        onConfirm={() => {
          withdrawConsentMutation.mutate({ confirmation: "RETIRER" });
        }}
        loading={withdrawConsentMutation.isPending}
      />
    </DashboardShell>
  );
}
