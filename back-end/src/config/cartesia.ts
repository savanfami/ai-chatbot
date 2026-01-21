// cartesiaTTS.ts
import WebSocket from "ws";
import { randomUUID } from "crypto";

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY!;
const CARTESIA_VERSION = "2024-06-10";

const cartesiaSocket = new WebSocket("wss://api.cartesia.ai/tts/websocket", {
  headers: {
    "Cartesia-Version": CARTESIA_VERSION,
    "X-API-Key": CARTESIA_API_KEY,
  },
});

cartesiaSocket.on("open", () => console.log("Cartesia WebSocket connected"));
cartesiaSocket.on("error", (err) =>
  console.error("Cartesia WebSocket error:", err),
);
cartesiaSocket.on("close", () => console.log("Cartesia WebSocket closed"));

export function streamCartesiaTTS(
  text: string,
  onAudioChunk: (chunk: Buffer) => void,
  onEnd: () => void,
  onError: (err: any) => void,
) {
  const contextId = randomUUID();

  const handleMessage = (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "chunk" && msg.data) {
        onAudioChunk(Buffer.from(msg.data, "base64"));
      } else if (msg.type === "done") {
        onEnd();
        cartesiaSocket.off("message", handleMessage);
      } else if (msg.type === "error") {
        onError(new Error(msg.error));
        cartesiaSocket.off("message", handleMessage);
      }
    } catch (err) {
      onError(err);
      cartesiaSocket.off("message", handleMessage);
    }
  };

  cartesiaSocket.on("message", handleMessage);

  cartesiaSocket.send(
    JSON.stringify({
      context_id: contextId,
      model_id: "sonic-english",
      voice: { mode: "id", id: "e07c00bc-4134-4eae-9ea4-1a55fb45746b" },
      output_format: {
        container: "raw",
        encoding: "pcm_s16le",
        sample_rate: 44100,
      },
      language: "en",
      transcript: text,
    }),
  );
}
