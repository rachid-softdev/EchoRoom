"use client";

import { AlertTriangle, Clock, Download, Loader2, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

interface AudioPlayerProps {
  /** The URL of the audio file to play, or null/undefined when unavailable */
  recordingUrl: string | null | undefined;
  /** Optional title displayed above the player controls */
  title?: string;
}

/**
 * An audio player with play/pause, seek, and download controls.
 *
 * @description Uses the HTML5 Audio API via useRef to manage playback state.
 * Handles three states: no recording (empty state), loading (spinner), and
 * error (alert with retry message). When loaded, renders play/pause toggle,
 * a progress slider, time display, and a download button.
 * @example
 * <AudioPlayer recordingUrl="https://example.com/audio.mp3" title="Episode 1" />
 * @returns A player UI or a fallback state message
 */
export function AudioPlayer({ recordingUrl, title }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Reset states when recordingUrl changes
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (!audioRef.current) {
      if (!recordingUrl) return;
      const audio = new Audio(recordingUrl);
      audio.preload = "auto";

      audio.addEventListener("loadedmetadata", () => {
        setDuration(audio.duration);
        setIsLoaded(true);
      });

      audio.addEventListener("timeupdate", () => {
        setCurrentTime(audio.currentTime);
      });

      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });

      audio.addEventListener("error", () => {
        setIsLoaded(false);
        setHasError(true);
      });

      audio.playbackRate = playbackRate;
      audioRef.current = audio;
      audio.play().catch(() => {
        setIsPlaying(false);
      });
      setIsPlaying(true);
    } else if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {
        setIsPlaying(false);
      });
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [recordingUrl, playbackRate]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackRate(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, []);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!recordingUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-sm">Aucun enregistrement disponible</p>
      </div>
    );
  }

  if (!isLoaded && recordingUrl !== null && !hasError) {
    return (
      <div className="flex flex-col items-center py-6">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
        <p className="text-xs text-muted-foreground">Préparation de l'audio...</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-sm text-destructive font-medium mb-1">Chargement impossible</p>
        <p className="text-xs text-muted-foreground">L'audio n'est pas accessible. Réessayez.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-6">
      {title && <p className="text-sm text-muted-foreground mb-4">{title}</p>}

      <Button
        size="lg"
        className="rounded-full w-16 h-16 mb-4"
        onClick={handleTogglePlay}
        disabled={!isLoaded}
      >
        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
      </Button>

      {isLoaded && duration > 0 && (
        <div className="w-full max-w-sm space-y-2">
          <input
            type="range"
            min={0}
            max={duration}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 appearance-none bg-secondary rounded-full cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {isLoaded && duration > 0 && (
        <div className="flex items-center justify-center gap-1 mt-3">
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => handleSpeedChange(speed)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                playbackRate === speed
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      )}

      {recordingUrl && (
        <a href={recordingUrl} download target="_blank" rel="noopener noreferrer" className="mt-4">
          <Button variant="ghost" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Télécharger
          </Button>
        </a>
      )}
    </div>
  );
}
