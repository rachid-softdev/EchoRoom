"use client";

import { ExternalLink, MessageCircle, Music, Share2 } from "lucide-react";
import { Button, toast } from "@echoroom/ui";
import { api } from "@/lib/trpc";

interface ShareButtonsProps {
  scenarioId: string;
  title: string;
  description?: string;
}

function getBaseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function ShareButtons({ scenarioId, title, description }: ShareButtonsProps) {
  const trackMutation = api.social.trackShare.useMutation();
  const url = `${getBaseUrl()}/scenario/${scenarioId}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  function handleShare(platform: "TWITTER" | "DISCORD" | "TIKTOK" | "COPY_LINK" | "WEB_SHARE") {
    trackMutation.mutate({ scenarioId, platform });
  }

  function shareTwitter() {
    const text = description ? encodeURIComponent(`${title}\n\n${description}`) : encodedTitle;
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`,
      "_blank",
      "noopener,noreferrer",
    );
    handleShare("TWITTER");
  }

  function copyLink(platform: "DISCORD" | "TIKTOK" | "COPY_LINK" | "WEB_SHARE") {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast({ title: "Lien copié !", variant: "default" });
        handleShare(platform);
      })
      .catch(() => {
        toast({ title: "Échec de la copie", variant: "destructive" });
      });
  }

  async function shareNative() {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description ?? title,
          url,
        });
        handleShare("WEB_SHARE");
      } catch {
        // user cancelled
      }
    } else {
      copyLink("WEB_SHARE");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={shareTwitter}
        className="gap-1.5"
        disabled={trackMutation.isPending}
      >
        <ExternalLink className="w-4 h-4" />
        <span className="sr-only sm:not-sr-only">Twitter / X</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => copyLink("DISCORD")}
        className="gap-1.5"
        disabled={trackMutation.isPending}
      >
        <MessageCircle className="w-4 h-4" />
        <span className="sr-only sm:not-sr-only">Discord</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => copyLink("TIKTOK")}
        className="gap-1.5"
        disabled={trackMutation.isPending}
      >
        <Music className="w-4 h-4" />
        <span className="sr-only sm:not-sr-only">TikTok</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={shareNative}
        className="gap-1.5"
        disabled={trackMutation.isPending}
      >
        <Share2 className="w-4 h-4" />
        <span className="sr-only sm:not-sr-only">Partager</span>
      </Button>
    </div>
  );
}
