import { ElevenLabsClient } from "elevenlabs";
import { env } from "@/lib/env";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("tts");

let ttsClient: ElevenLabsClient | null = null;

try {
  ttsClient = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY });
} catch {
  log.warn("ElevenLabs unavailable");
}

export async function synthesizeSpeech(
  text: string,
  voiceId: string,
): Promise<ArrayBuffer | null> {
  if (!ttsClient) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await ttsClient.textToSpeech.convert(voiceId, {
      text,
      model_id: "eleven_flash_v2_5",
      output_format: "ulaw_8000",
    }, { signal: controller.signal });

    // Convert the stream to ArrayBuffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response) {
      chunks.push(chunk);
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result.buffer;
  } finally {
    clearTimeout(timeoutId);
  }
}

export { ttsClient };
