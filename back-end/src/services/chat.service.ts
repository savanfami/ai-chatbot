import { openai } from "../config/openai";
import { SYSTEM_PROMPT } from "../utils/prompts";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const ResponseSchema = z.object({
  message: z.string().nullable(),
  type: z.enum(["message", "assign_task"]),
  assignee: z.string().nullable(),
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

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    stream: true,
    response_format: zodResponseFormat(ResponseSchema, "response"),
  });

  let fullText = "";

  for await (const chunk of completion) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    fullText += delta;
    
    if (onChunk && delta) {
      onChunk(delta); 
    }
  }


  const parsed = JSON.parse(fullText);
  console.log(parsed,'praaaaaaaaaaseddd');
  messages.push({ role: "assistant", content: fullText });

  if (parsed.type === "assign_task") {
    return {
      full: fullText,
      parsed,
      messages,
    };
  }

  return {
    full: fullText, 
    parsed: null,
    messages,
  };
};