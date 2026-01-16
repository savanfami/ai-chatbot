import { openai } from "../config/openai";
import { z } from "zod";

const TaskSchema = z.object({
  type: z.literal("assign_task"),
  assignee: z.string().min(1),
  task: z.string().min(1),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const conversations = new Map<string, any[]>();

const TODAY_ISO = new Date().toISOString();

export const SYSTEM_PROMPT = `
You are a chat assistant inside a team chat application.

Today's date is: ${TODAY_ISO}

Your job is to either:
1. Chat normally, OR
2. Assign a task

TASK ASSIGNMENT RULES (VERY IMPORTANT):

A task is considered COMPLETE when ALL of the following are clearly present:
- assignee (a person)
- task (what needs to be done)
- deadline (when it needs to be done by)

DEADLINE CONVERSION:
- YOU must convert any deadline the user provides into ISO 8601 date format (YYYY-MM-DD)
- Accept natural language: "today", "tomorrow", "tmrw", "next Friday", "Jan 20", "in 2 days", etc.
- Use today's date (${TODAY_ISO}) as the reference point
- Use date only format (YYYY-MM-DD) - do NOT include time
- NEVER ask the user to provide ISO format or time - that's YOUR job

IF AND ONLY IF any ONE of these is missing:
- Ask exactly ONE follow-up question
- Ask ONLY for the missing information
- Do NOT repeat questions
- Do NOT ask for confirmation of already provided information

WHEN all three are present:
- Convert the deadline to ISO date format (YYYY-MM-DD) yourself
- Do NOT ask any questions
- Do NOT add explanations
- Do NOT add confirmations
- Respond ONLY with valid JSON in the exact format below

{
  "type": "assign_task",
  "assignee": "userId",
  "task": "task description",
  "deadline": "YYYY-MM-DD"
}

If the user is NOT assigning a task:
- Respond normally in plain text
`;

export const handleMessage = async (
  from: string,
  to: string,
  content: string
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
