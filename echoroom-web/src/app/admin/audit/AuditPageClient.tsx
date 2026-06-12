"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui"
import { Button } from "@/components/ui"
import { DataLoader } from "@/components/shared/DataLoader"
import { api } from "@/lib/trpc"
import { ScrollText } from "lucide-react"

const actionOptions = [
  { label: "Toutes les actions", value: undefined },
  { label: "Approbation", value: "APPROVE_SCENARIO" },
  { label: "Rejet", value: "REJECT_SCENARIO" },
  { label: "Blocage numéro", value: "BLOCK_NUMBER" },
  { label: "Déblocage numéro", value: "UNBLOCK_NUMBER" },
  { label: "Suppression commentaire", value: "DELETE_COMMENT" },
  { label: "Signalement ignoré", value: "DISMISS_ABUSE_REPORT" },
  { label: "Mise en avant", value: "FEATURE_SCENARIO" },
  { label: "Suppression utilisateur", value: "DELETE_USER" },
]

const entityTypeOptions = [
  { label: "Tous les types", value: undefined },
  { label: "Scénario", value: "Scenario" },
  { label: "Commentaire", value: "Comment" },
  { label: "Utilisateur", value: "User" },
  { label: "Numéro bloqué", value: "BlockedNumber" },
  { label: "Signalement", value: "AbuseReport" },
]

const actionLabels: Record<string, string> = {
  APPROVE_SCENARIO: "Approbation",
  REJECT_SCENARIO: "Rejet",
  BLOCK_NUMBER: "Blocage numéro",
  UNBLOCK_NUMBER: "Déblocage numéro",
  DELETE_COMMENT: "Suppression commentaire",
  DISMISS_ABUSE_REPORT: "Signalement ignoré",
  FEATURE_SCENARIO: "Mise en avant",
  DELETE_USER: "Suppression utilisateur",
  REMOVE_FEATURED: "Retrait mise en avant",
}

export default function AuditPageClient() {
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined)
  const [entityFilter, setEntityFilter] = useState<string | undefined>(undefined)
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const auditQuery = api.admin.getAuditLogs.useQuery({
    action: actionFilter,
    entityType: entityFilter,
    startDate: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    endDate: dateTo ? new Date(`${dateTo}T23:59:59.999Z`).toISOString() : undefined,
    cursor,
    limit: 20,
  })

  function handleResetFilters() {
    setActionFilter(undefined)
    setEntityFilter(undefined)
    setDateFrom("")
    setDateTo("")
    setCursor(undefined)
  }

  const hasDateFilter = dateFrom || dateTo

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Journal d&apos;audit</h1>
          <p className="text-muted-foreground mt-1">
            Consultez l&apos;historique des actions administratives
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground"
          value={actionFilter ?? ""}
          onChange={(e) => {
            setActionFilter(e.target.value || undefined)
            setCursor(undefined)
          }}
        >
          {actionOptions.map((opt) => (
            <option key={opt.label} value={opt.value ?? ""}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground"
          value={entityFilter ?? ""}
          onChange={(e) => {
            setEntityFilter(e.target.value || undefined)
            setCursor(undefined)
          }}
        >
          {entityTypeOptions.map((opt) => (
            <option key={opt.label} value={opt.value ?? ""}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground shrink-0">Du</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setCursor(undefined)
            }}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground [color-scheme:dark]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground shrink-0">Au</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setCursor(undefined)
            }}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground [color-scheme:dark]"
          />
        </div>
        {(actionFilter || entityFilter || hasDateFilter) && (
          <Button variant="ghost" size="sm" onClick={handleResetFilters}>
            Réinitialiser
          </Button>
        )}
      </div>

      <DataLoader
        query={auditQuery}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <Card className="border-border/50">
            <CardContent className="py-16 text-center">
              <ScrollText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune entrée</h3>
              <p className="text-muted-foreground">
                Aucune entrée de journal d&apos;audit pour ces filtres.
              </p>
            </CardContent>
          </Card>
        }
      >
        {(data) => (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">
                {data.items.length} entrée{data.items.length > 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                        Date
                      </th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                        Admin
                      </th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                        Action
                      </th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                        Type
                      </th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                        ID
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.admin?.username ?? "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {actionLabels[log.action] ?? log.action}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {log.entityType}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs whitespace-nowrap max-w-[120px] truncate">
                          {log.entityId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </DataLoader>

      {/* Pagination */}
      {auditQuery.data?.nextCursor && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={() => setCursor(auditQuery.data?.nextCursor)}
            disabled={auditQuery.isFetching}
          >
            {auditQuery.isFetching ? "Chargement..." : "Charger plus"}
          </Button>
        </div>
      )}
    </div>
  )
}
