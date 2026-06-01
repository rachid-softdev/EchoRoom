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
  const callId = params.callId as string;

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
          scenarioTitle={matchingCall.scenario?.title}
          characterName={matchingCall.scenario?.character?.name}
          durationSeconds={matchingCall.durationSeconds}
          status={matchingCall.status}
        />
      )}

      <DataLoader query={replayQuery}>
        {(data) => (
          <div className="space-y-6">
            <AudioPlayer
              recordingUrl={data.recordingUrl}
              title={matchingCall?.scenario?.title}
            />

            <TranscriptView
              transcript={data.transcript ?? null}
              isLoading={replayQuery.isFetching}
              scenarioName={matchingCall?.scenario?.title}
            />
          </div>
        )}
      </DataLoader>
    </DashboardShell>
  );
}
