import { createClient } from "@deepgram/sdk";
import { handleMessage } from "../services/chat.service";

export const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const connection = deepgram.listen.live({
  model: "nova-2",
  language: "en-IN",
  smart_format: true,
  interim_results: true,
});

connection.on("transcript", (data) => {
  const text = data.channel.alternatives[0]?.transcript;

  if (!text) return;

  if (data.is_final) {
    // const res=await handleMessage ()
    console.log("FINAL:", text);
  } else {
    console.log("PARTIAL:", text);
  }
});
