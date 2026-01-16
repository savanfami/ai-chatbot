import { Server } from "socket.io";
import {
  handleMessage,
  conversations,
  pendingTasks,
} from "../services/chat.service";
import { resolveAssignee } from "../utils/utils";
import users from "../data/users.json";

export const setupChatSocket = (io: Server) => {
  io.on("connection", (socket) => {
    console.log("New socket connected:", socket.id);

    socket.on("join", (userId: string) => {
      socket.join(userId);
      console.log(`${userId} joined`);
    });

    socket.on("message", async ({ from, to, content }) => {
      if (to !== "bot") {
        io.to(to).emit("message", { from, content });
        return;
      }

      const { full, parsed, messages } = await handleMessage(from, to, content);
      console.log(full, "full");
      console.log(parsed, "parsed");
      console.log(messages, "messages");
      if (!parsed) {
        console.log('erhe  called');
        conversations.set(from, messages);
        socket.emit("message", { from: "bot", content: full });
        return;
      }

      if (parsed.type === "assign_task") {
        conversations.delete(from);
        pendingTasks.delete(from);

        const resolution = resolveAssignee(parsed.assignee, users);
        if (!resolution) {
          socket.emit("message", {
            from: "bot",
            content: `I couldn’t find a user named "${parsed.assignee}".`,
          });
          return;
        }
        io.to(resolution).emit("message", {
          from: from,
          generatedBy: "bot",
          content: `Task: ${parsed.task}\n⏰ Deadline: ${parsed.deadline}`,
        });

        socket.emit("message", {
          from: "bot",
          content: " Task assigned successfully",
        });
      }
    });
  });
};
