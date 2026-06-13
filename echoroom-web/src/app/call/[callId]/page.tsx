"use client";

import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { DataLoader } from "@/components/shared/DataLoader";
import { ReplayHeader } from "@/components/player/ReplayHeader";
import { AudioPlayer } from "@/components/player/AudioPlayer";
import { TranscriptView } from "@/components/player/TranscriptView";
import { api } from "@/lib/trpc";

export default function CallReplayPage() {
  const params = useParams();
  const callId = params["callId"] as string;

  const replayQuery = api.calls.replay.useQuery({ callId });
  const callsQuery = api.calls.history.useQuery({ limit: 1 });

  const matchingCall = callsQuery.data?.items?.find((c: any) => c.id === callId) as
    | {
        scenario?: { title?: string; character?: { name?: string } };
        durationSeconds?: number;
        status?: string;
      }
    | undefined;

  return (
    <DashboardShell
      title="Replay de l'appel"
      backHref="/history"
    >
      {matchingCall ? (
        <div className="flex items-center gap-3 mb-6 text-sm text-muted-foreground">
          {matchingCall.scenario?.title && (
            <span className="font-medium text-foreground">{matchingCall.scenario.title}</span>
          )}
          {matchingCall.status && (
            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
              {matchingCall.status === "COMPLETED" ? "Terminé" : matchingCall.status}
            </span>
          )}
        </div>
      ) : null}
      {matchingCall && (
        <ReplayHeader
          {...(matchingCall.scenario?.title ? { scenarioTitle: matchingCall.scenario.title } : {})}
          {...(matchingCall.scenario?.character?.name ? { characterName: matchingCall.scenario.character.name } : {})}
          {...(matchingCall.durationSeconds !== undefined ? { durationSeconds: matchingCall.durationSeconds } : {})}
          {...(matchingCall.status ? { status: matchingCall.status } : {})}
        />
      )}

      <DataLoader query={replayQuery}>
        {(data) => (
          <div className="space-y-6">
            <AudioPlayer
              recordingUrl={data.recordingUrl}
              {...(matchingCall?.scenario?.title ? { title: matchingCall.scenario.title } : {})}
            />

            <TranscriptView
              transcript={data.transcript ?? null}
              isLoading={replayQuery.isFetching}
              {...(matchingCall?.scenario?.title ? { scenarioName: matchingCall.scenario.title } : {})}
            />
          </div>
        )}
      </DataLoader>
    </DashboardShell>
  );
}
