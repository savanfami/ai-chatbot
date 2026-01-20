import { openai } from "../config/openai";
import { SYSTEM_PROMPT } from "../utils/prompts";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const ResponseSchema = z.object({
  message: z.string().nullable(),
  assignee: z.string().nullable(),
  type: z.enum(["message", "assign_task"]),
  task: z.string().nullable(),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

export const conversations = new Map<string, any[]>();

export const handleMessage = async (
  from: string,
  content: string,
  onChunk?: (chunk: string) => void,
) => {
  const messages = conversations.get(from) ?? [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  messages.push({ role: "user", content });
  console.log(messages, "messages");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    stream: true,
    response_format: zodResponseFormat(ResponseSchema, "response"),
  });

  let fullText = "";
  let visibleText = "";

  for await (const chunk of completion) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (!delta) continue;

    fullText += delta;

    const messageKeyIndex = fullText.indexOf('"message"');
    if (messageKeyIndex === -1) continue;

    const afterMessage = fullText.slice(messageKeyIndex);

    const colonIndex = afterMessage.indexOf(":");
    if (colonIndex === -1) continue;

    // ✅ NEW: check if message value is actually a string
    const valueAfterColon = afterMessage.slice(colonIndex + 1).trim();

    // 🚫 message is null → do NOT stream anything
    if (!valueAfterColon.startsWith('"')) {
      continue;
    }

    const firstQuote = afterMessage.indexOf('"', colonIndex + 1);
    if (firstQuote === -1) continue;

    const secondQuote = afterMessage.indexOf('"', firstQuote + 1);

    const currentMessage =
      secondQuote === -1
        ? afterMessage.slice(firstQuote + 1)
        : afterMessage.slice(firstQuote + 1, secondQuote);

    const newText = currentMessage.slice(visibleText.length);

    if (newText) {
      visibleText += newText;
      onChunk?.(newText);
    }
  }

  const parsed = JSON.parse(fullText);
  console.log(parsed, "parsed");
  messages.push({ role: "assistant", content: parsed.message ?? "" });

  return {
    parsed,
    messages,
  };
};
