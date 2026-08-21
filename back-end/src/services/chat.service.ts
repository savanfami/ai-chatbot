import { openai } from "../config/openai";
import { SYSTEM_PROMPT } from "../utils/prompts";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { searchRelevantDocs } from "../utils/helpers";

const ResponseSchema = z.object({
  message: z.string().nullable(),
  assignee: z.string().nullable(),
  type: z.enum(["message", "assign_task"]),
  task: z.string().nullable(),
  deadline: z.string().nullable(),
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
  const contextDocs = await searchRelevantDocs(content);
  console.log("Retrieved RAG Context Docs:", contextDocs);
  const context = contextDocs.join("\n\n");
  messages.push({
    role: "system",
    content: `Use the context below to answer. If not found, say you don't know.

Context:
${context}`,
  });

  messages.push({
    role: "user",
    content,
  });

  // Model selection (Uses Groq openai/gpt-oss-20b by default, or OpenAI gpt-4o if configured)
  // Previous OpenAI line: model: "gpt-4o",
  const completion = await openai.chat.completions.create({
    model: process.env.MODEL_NAME || (process.env.GROQ_API_KEY ? "openai/gpt-oss-20b" : "gpt-4o"),
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

    const valueAfterColon = afterMessage.slice(colonIndex + 1).trim();

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

  messages.push({ role: "assistant", content: parsed.message ?? "" });

  return {
    parsed,
    messages,
  };
};
