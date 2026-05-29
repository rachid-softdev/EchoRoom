import { createClient, type DeepgramClient } from "@deepgram/sdk";
import { env } from "@/lib/env";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("transcription");

let deepgram: DeepgramClient | null = null;

try {
  deepgram = createClient(env.DEEPGRAM_API_KEY);
} catch {
  log.warn("Deepgram unavailable");
}

interface TranscriptionResult {
  transcript: string;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export async function transcribeAudio(
  audioBuffer: ArrayBuffer,
  _mimetype: string = "audio/wav",
): Promise<TranscriptionResult | null> {
  if (!deepgram) {
    return null;
  }

  const fileBuffer = Buffer.from(audioBuffer);
  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    fileBuffer,
    {
      model: "nova-2",
      language: "fr",
      punctuate: true,
      paragraphs: true,
    },
  );

  if (error || !result) {
    log.error("Deepgram transcription error", { error });
    return {
      transcript: "",
      confidence: 0,
      words: [],
    };
  }

  const channel = result.results?.channels[0];
  const alternative = channel?.alternatives[0];

  if (!alternative) {
    return {
      transcript: "",
      confidence: 0,
      words: [],
    };
  }

  return {
    transcript: alternative.transcript,
    confidence: alternative.confidence,
    words:
      alternative.words?.map(
        (w: { word: string; start: number; end: number; confidence: number }) => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.confidence,
        }),
      ) ?? [],
  };
}

export { deepgram };
