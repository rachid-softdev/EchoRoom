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
      <p className="text-sm text-muted-foreground mb-6 font-mono">
        ID : {callId}
      </p>
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
