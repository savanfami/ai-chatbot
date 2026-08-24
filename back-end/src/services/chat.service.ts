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

const SELECTED_MODEL = process.env.MODEL_NAME || (process.env.GROQ_API_KEY ? "openai/gpt-oss-20b" : "gpt-4o");

/**
 * Contextualization: Reformulates follow-up queries using chat history so Pinecone vector search receives standalone entities.
 */
async function reformulateQuery(messagesHistory: any[], userQuery: string): Promise<string> {
  const historyTurns = messagesHistory.filter((m) => m.role === "user" || m.role === "assistant");
  if (historyTurns.length === 0) {
    return userQuery;
  }

  try {
    const prompt = `Given the chat history below and a follow-up question, rewrite the follow-up question into a standalone search query that includes all necessary names, subjects, and context. Do NOT answer the question, output ONLY the rewritten standalone question.

Chat History:
${historyTurns.slice(-4).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}

Follow-Up Question: ${userQuery}
Standalone Search Query:`;

    const completion = await openai.chat.completions.create({
      model: SELECTED_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    });

    const standalone = completion.choices[0]?.message?.content?.trim();
    if (standalone && standalone.length > 3) {
      console.log(`🔍 Reformulated Query: "${userQuery}" ──> "${standalone}"`);
      return standalone;
    }
  } catch (err) {
    console.warn("Query reformulation fallback, using raw query:", err);
  }

  return userQuery;
}

export const handleMessage = async (
  from: string,
  content: string,
  onChunk?: (chunk: string) => void,
) => {
  const messages = conversations.get(from) ?? [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  // 1. Reformulate follow-up queries using conversation history
  const standaloneQuery = await reformulateQuery(messages, content);

  // 2. Search Pinecone vector DB with the standalone query
  const contextDocs = await searchRelevantDocs(standaloneQuery);
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
  const completion = await openai.chat.completions.create({
    model: SELECTED_MODEL,
    messages,
    stream: true,
    response_format: { type: "json_object" },
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

  let parsed: any = {};
  try {
    parsed = JSON.parse(fullText);
  } catch (err) {
    parsed = { type: "message", message: visibleText || fullText };
  }

  parsed.type = parsed.type || "message";
  parsed.message = parsed.message ?? visibleText;

  messages.push({ role: "assistant", content: parsed.message ?? "" });

  return {
    parsed,
    messages,
  };
};
