'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui'
import { Play, Pause, Download, Clock } from 'lucide-react'

interface AudioPlayerProps {
  recordingUrl: string | null | undefined
  title?: string
}

export function AudioPlayer({ recordingUrl, title }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const handleTogglePlay = useCallback(() => {
    if (!audioRef.current) {
      if (!recordingUrl) return
      const audio = new Audio(recordingUrl)
      audio.preload = 'auto'

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration)
        setIsLoaded(true)
      })

      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime)
      })

      audio.addEventListener('ended', () => {
        setIsPlaying(false)
        setCurrentTime(0)
      })

      audio.addEventListener('error', () => {
        setIsLoaded(false)
      })

      audioRef.current = audio
      audio.play().catch(() => {
        setIsPlaying(false)
      })
      setIsPlaying(true)
    } else if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {
        setIsPlaying(false)
      })
      setIsPlaying(true)
    } else {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }, [recordingUrl])

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = Number(e.target.value)
      setCurrentTime(time)
      if (audioRef.current) {
        audioRef.current.currentTime = time
      }
    },
    [],
  )

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!recordingUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-sm">
          Aucun enregistrement disponible
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center py-6">
      {title && (
        <p className="text-sm text-muted-foreground mb-4">{title}</p>
      )}

      <Button
        size="lg"
        className="rounded-full w-16 h-16 mb-4"
        onClick={handleTogglePlay}
        disabled={!isLoaded && recordingUrl !== null}
      >
        {isPlaying ? (
          <Pause className="w-6 h-6" />
        ) : (
          <Play className="w-6 h-6 ml-0.5" />
        )}
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

      {recordingUrl && (
        <a
          href={recordingUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4"
        >
          <Button variant="ghost" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Télécharger
          </Button>
        </a>
      )}
    </div>
  )
}
