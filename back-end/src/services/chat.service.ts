import { openai } from "../config/openai";
import { z } from "zod";
import { SYSTEM_PROMPT } from "../utils/prompts";

const TaskSchema = z.object({
  type: z.literal("assign_task"),
  assignee: z.string().min(1),
  task: z.string().min(1),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const conversations = new Map<string, any[]>();

export const handleMessage = async (
  from: string,
  to: string,
  content: string,
) => {
  const messages = conversations.get(from) ?? [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  messages.push({ role: "user", content });

  const stream = await openai.responses.create({
    model: "gpt-4o-mini",
    stream: true,
    input: messages,
  });

  let full = "";
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      full += event.delta;
    }
  }
  let parsed: any = null;
  try {
    parsed = JSON.parse(full);
    const result = TaskSchema.safeParse(parsed);

    if (result.success) {
      parsed = result.data;
    }
  } catch {}

  return { full, parsed, messages };
};
