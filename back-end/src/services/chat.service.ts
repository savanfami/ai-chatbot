import { openai } from "../config/openai";
import { zodFunction } from "openai/helpers/zod";
import { SYSTEM_PROMPT } from "../utils/prompts";
import { z } from "zod";

const TaskSchema = z.object({
  assignee: z.string().min(1),
  task: z.string().min(1),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "assign_task",
        schema: {
          type: "object",
          properties: {
            assignee: { type: "string" },
            task: { type: "string" },
            deadline: { type: "string" },
          },
          required: ["assignee", "task", "deadline"],
        },
      },
    },
  });

  const raw = completion.choices[0].message.content;

  if (!raw) {
    return { full: "", parsed: null, messages };
  }

  try {
    const parsedJson = JSON.parse(raw);
    console.log(parsedJson, "parsed json");
    const validation = TaskSchema.safeParse(parsedJson);

    if (!validation.success) {
      return {
        full: "Invalid task format. Please provide assignee, task, and deadline.",
        parsed: null,
        messages,
      };
    }

    const parsed = {
      type: "assign_task" as const,
      ...validation.data,
    };

    messages.push({
      role: "assistant",
      content: JSON.stringify(parsed),
    });

    return {
      full: JSON.stringify(parsed),
      parsed,
      messages,
    };
  } catch {
    return {
      full: "Failed to understand the task request.",
      parsed: null,
      messages,
    };
  }
};
