import { Server } from "socket.io";
import { handleMessage, conversations } from "../services/chat.service";
import { resolveAssignee } from "../utils/utils";
import users from "../data/users.json";
import { Conversation } from "../model/conversation";
import { Message } from "../model/message";
import { v4 as uuidv4 } from "uuid";

export const setupChatSocket = (io: Server) => {
  io.on("connection", (socket) => {
    console.log("New socket connected:", socket.id);

    socket.on("join", (userId: string) => {
      socket.join(userId);
      console.log(`${userId} joined`);
    });

    socket.on("message", async ({ from, to, content }) => {
      if (to !== "bot") {
        let conversation = await Conversation.findOne({
          participants: { $all: [from, to] },
        });

        if (!conversation) {
          conversation = await Conversation.create({
            id: uuidv4(),
            participants: [from, to],
          });
        }
        await Message.create({
          id: uuidv4(),
          conversationId: conversation.id,
          from,
          to,
          content,
        });
        io.to(to).emit("message", { from, content });
        return;
      }

      let botConversation = await Conversation.findOne({
        participants: { $all: [from, "bot"] },
      });
      if (!botConversation) {
        botConversation = await Conversation.create({
          id: uuidv4(),
          participants: [from, "bot"],
        });
      }

      await Message.create({
        id: uuidv4(),
        conversationId: botConversation.id,
        from,
        to,
        content,
      });

      const { full, parsed, messages } = await handleMessage(from, content);

      if (!parsed) {
        conversations.set(from, messages);
        const botConversation =
          (await Conversation.findOne({
            participants: { $all: [from, "bot"] },
          })) ||
          (await Conversation.create({
            id: uuidv4(),
            participants: [from, "bot"],
          }));

        await Message.create({
          id: uuidv4(),
          conversationId: botConversation.id,
          from: "bot",
          to: from,
          content: full,
          generatedBy: "bot",
        });

        socket.emit("message", { from: "bot", content: full });
        return;
      }

      if (parsed.type === "assign_task") {
        conversations.delete(from);

        const resolution = resolveAssignee(parsed.assignee, users);
        if (!resolution) {
          socket.emit("message", {
            from: "bot",
            content: `I couldn’t find a user named "${parsed.assignee}".`,
          });
          return;
        }
        let conv = await Conversation.findOne({
          participants: { $all: [from, resolution] },
        });
        if (!conv) {
          conv = await Conversation.create({
            id: uuidv4(),
            participants: [from, resolution],
          });
        }

        await Message.create({
          id: uuidv4(),
          conversationId: conv.id,
          from,
          to: resolution,
          content: `Task: ${parsed.task}\n⏰ Deadline: ${parsed.deadline}`,
          generatedBy: "bot",
        });
        io.to(resolution).emit("message", {
          from: from,
          generatedBy: "bot",
          content: `Task: ${parsed.task}\n⏰ Deadline: ${parsed.deadline}`,
        });

        const botConv =
          (await Conversation.findOne({
            participants: { $all: [from, "bot"] },
          })) ||
          (await Conversation.create({
            id: uuidv4(),
            participants: [from, "bot"],
          }));

        await Message.create({
          id: uuidv4(),
          conversationId: botConv.id,
          from: "bot",
          to: from,
          content: "Task assigned successfully",
          generatedBy: "bot",
        });

        socket.emit("message", {
          from: "bot",
          content: " Task assigned successfully",
        });
      }
    });
  });
};
