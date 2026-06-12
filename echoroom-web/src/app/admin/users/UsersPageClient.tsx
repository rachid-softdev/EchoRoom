"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui";
import { DataLoader } from "@/components/shared/DataLoader";
import { api } from "@/lib/trpc";
import { Users, Search, X, ChevronLeft } from "lucide-react";

const roleBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  ADMIN: "default",
  USER: "secondary",
  MODERATOR: "outline",
};

const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  USER: "Utilisateur",
  MODERATOR: "Modérateur",
};

export default function UsersPageClient() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Debounce search to avoid firing a query on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const listQuery = api.admin.listUsers.useQuery({
    search: debouncedSearch || undefined,
    limit: 50,
  });

  const detailQuery = api.admin.getUserDetail.useQuery(
    { userId: selectedUserId ?? "" },
    { enabled: !!selectedUserId },
  );

  const selectedUser = detailQuery.data;

  if (selectedUser) {
    return (
      <div>
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedUserId(null)}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {selectedUser.username}
            </h1>
            <p className="text-muted-foreground mt-1">
              {selectedUser.email}
            </p>
          </div>
          <Badge
            variant={roleBadgeVariant[selectedUser.role] ?? "secondary"}
            className="text-xs"
          >
            {roleLabels[selectedUser.role] ?? selectedUser.role}
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-xs">{selectedUser.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Crédits</span>
                <span className="font-medium">{selectedUser.credits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Appels</span>
                <span className="font-medium">{selectedUser.totalCallsMade}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Likes reçus</span>
                <span className="font-medium">{selectedUser.totalLikesReceived}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Consentement</span>
                <span className="font-medium">
                  {selectedUser.consentAcceptedAt
                    ? new Date(selectedUser.consentAcceptedAt).toLocaleDateString("fr-FR")
                    : "Non"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Inscrit le</span>
                <span className="font-medium">
                  {new Date(selectedUser.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Statistiques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scénarios</span>
                <span className="font-medium">
                  {selectedUser._count?.scenarios ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commentaires</span>
                <span className="font-medium">
                  {selectedUser._count?.comments ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Réactions</span>
                <span className="font-medium">
                  {selectedUser._count?.reactions ?? 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground mt-1">
            Recherchez et gérez les utilisateurs de la plateforme
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-10"
        />
        {search && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch("")}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <DataLoader
        query={listQuery}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <Card className="border-border/50">
            <CardContent className="py-16 text-center">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun utilisateur</h3>
              <p className="text-muted-foreground">
                {search
                  ? "Aucun utilisateur ne correspond à votre recherche."
                  : "Aucun utilisateur enregistré."}
              </p>
            </CardContent>
          </Card>
        }
      >
        {(data) => (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">
                {data.items.length} utilisateur{data.items.length > 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.items.map((user) => (
                  <button
                    type="button"
                    key={user.id}
                    className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors text-left cursor-pointer"
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {user.deletedAt ? (
                          <span className="text-muted-foreground line-through">
                            {user.username}
                          </span>
                        ) : (
                          user.username
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <Badge
                        variant={roleBadgeVariant[user.role] ?? "secondary"}
                        className="text-xs"
                      >
                        {roleLabels[user.role] ?? user.role}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {user.credits} crédits
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </DataLoader>
    </div>
  );
}
