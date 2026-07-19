import { MessageSquare } from "lucide-react";
import { Skeleton } from "@echoroom/ui";

interface TranscriptChunk {
  speaker: string;
  text: string;
  timestamp?: number;
}

interface TranscriptViewProps {
  transcript: TranscriptChunk[] | null | undefined;
  isLoading: boolean;
  scenarioName?: string;
}

function formatTimestamp(ts?: number): string {
  if (!ts) return "";
  const m = Math.floor(ts / 60);
  const s = Math.floor(ts % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptView({ transcript, isLoading, scenarioName }: TranscriptViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`skel-${i}`} className={`flex gap-3 ${i % 2 === 1 ? "justify-end" : ""}`}>
            {i % 2 === 0 && <Skeleton className="w-8 h-8 rounded-full shrink-0" />}
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-48 rounded-xl" />
            </div>
            {i % 2 === 1 && <Skeleton className="w-8 h-8 rounded-full shrink-0" />}
          </div>
        ))}
      </div>
    );
  }

  if (!transcript || transcript.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          {transcript === null
            ? "Transcript en cours de traitement…"
            : "Aucune transcription disponible"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {transcript.map((chunk, i) => {
        const isAi = chunk.speaker === "assistant";
        return (
          <div key={`msg-${i}`} className={`flex gap-3 ${isAi ? "" : "justify-end"}`}>
            {isAi && (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                IA
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
                isAi ? "bg-muted rounded-tl-none" : "bg-secondary rounded-tr-none"
              }`}
            >
              <p className="font-medium text-xs mb-1 text-muted-foreground">
                {isAi ? (scenarioName ?? "Personnage IA") : "Vous"}
                {chunk.timestamp && (
                  <span className="ml-2">{formatTimestamp(chunk.timestamp)}</span>
                )}
              </p>
              <p>{chunk.text}</p>
            </div>
            {!isAi && (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                Moi
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
