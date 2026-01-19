import { openai } from "../config/openai";
import { SYSTEM_PROMPT } from "../utils/prompts";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const ResponseSchema = z.object({
  type: z.enum(["message", "assign_task"]),
  message: z.string().nullable(),
  assignee: z.string().nullable(),
  task: z.string().nullable(),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

export const conversations = new Map<string, any[]>();

export const handleMessage = async (from: string, content: string) => {
  const messages = conversations.get(from) ?? [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  messages.push({ role: "user", content });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    response_format: zodResponseFormat(ResponseSchema, "response"),
  });

  const reply = completion.choices[0].message.content ?? "";
  const parsed = JSON.parse(reply);

  messages.push({ role: "assistant", content: reply });

  if (parsed.type === "assign_task") {
    return {
      full: reply,
      parsed,
      messages,
    };
  }

  return {
    full: parsed.message,
    parsed: null,
    messages,
  };
};
