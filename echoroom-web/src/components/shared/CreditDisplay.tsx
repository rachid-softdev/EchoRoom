"use client";

import { Phone } from "lucide-react";
import { useSession } from "next-auth/react";
import { Badge, Skeleton } from "@echoroom/ui";
import { Tooltip } from "@echoroom/ui/tooltip";

interface CreditDisplayProps {
  /** Credits to display. Falls back to `useSession()` if not provided. */
  credits?: number;
}

export function CreditDisplay({ credits: propCredits }: CreditDisplayProps) {
  const { data: session } = useSession();
  const credits = propCredits ?? (session?.user as { credits?: number } | undefined)?.credits;

  if (credits === undefined) {
    return <Skeleton className="h-5 w-20 rounded-lg" />;
  }

  return (
    <Tooltip
      content="Chaque appel consomme 1 crédit. 5 gratuits à l&apos;inscription."
      side="bottom"
    >
      <Badge variant="secondary" className="text-xs cursor-help">
        <Phone className="w-3 h-3 mr-1" />
        {credits} crédits
      </Badge>
    </Tooltip>
  );
}
