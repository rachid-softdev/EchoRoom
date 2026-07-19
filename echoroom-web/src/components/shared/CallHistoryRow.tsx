import { Phone, Play } from "lucide-react";
import Link from "next/link";
import { Badge, Button } from "@echoroom/ui";
import { formatDate, formatDuration, STATUS_LABELS, STATUS_VARIANTS } from "@/lib/constants";

interface CallData {
  id: string;
  status: string;
  durationSeconds: number;
  createdAt: string | Date;
  scenario?: {
    title: string;
    character?: { name: string };
  };
}

interface CallHistoryRowProps {
  call: CallData;
}

export function CallHistoryRow({ call }: CallHistoryRowProps) {
  return (
    <div className="flex items-center justify-between py-4 px-4 rounded-xl border border-border/50 hover:border-border transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Phone className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{call.scenario?.title ?? "Appel"}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant={STATUS_VARIANTS[call.status] ?? "outline"}
              className="text-[10px] px-1.5 py-0"
            >
              {STATUS_LABELS[call.status] ?? call.status}
            </Badge>
            <span className="text-xs text-muted-foreground">{formatDate(call.createdAt)}</span>
            <span className="text-xs text-muted-foreground">
              {formatDuration(call.durationSeconds)}
            </span>
          </div>
        </div>
      </div>

      {call.status === "COMPLETED" && (
        <Link href={`/call/${call.id}`}>
          <Button variant="ghost" size="sm" className="gap-2 shrink-0">
            <Play className="w-4 h-4" />
            Replay
          </Button>
        </Link>
      )}
    </div>
  );
}
