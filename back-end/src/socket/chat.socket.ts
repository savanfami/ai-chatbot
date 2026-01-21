import { Server } from "socket.io";
import fs from "fs";
import { handleMessage, conversations } from "../services/chat.service";
import { resolveAssignee } from "../utils/utils";
import users from "../data/users.json";
import { Conversation } from "../model/conversation";
import { Message } from "../model/message";
import { v4 as uuidv4 } from "uuid";
import { deepgram } from "../config/deepgram";

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

      const { parsed, messages } = await handleMessage(
        from,
        content,
        (chunk) => {
          socket.emit("message_chunk", { chunk });
        },
      );
      if (parsed.type === "message") {
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
          content: parsed.message,
          generatedBy: "bot",
        });
        return;
      }

      if (parsed.type === "assign_task") {
        conversations.delete(from);

        const resolution = resolveAssignee(parsed.assignee, users);
        console.log(resolution, "resolution");
        if (!resolution) {
          socket.emit("message_complete", {
            from: "bot",
            content: `I couldn't find a user named "${parsed.assignee}".`,
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

        socket.emit("message_complete", {
          from: "bot",
          content: "Task assigned successfully",
        });
      }
    });

    socket.on("audio_message", async ({ from, to, audioBase64, mimeType }) => {
      try {
        const audioBuffer = Buffer.from(audioBase64, "base64");
        const { result, error } =
          await deepgram.listen.prerecorded.transcribeFile(audioBuffer, {
            model: "nova-2",
            language: "en-IN",
            smart_format: true,
            punctuate: true,
            mimetype: mimeType,
          });

        if (error) throw error;

        const text = result.results.channels[0].alternatives[0].transcript;

        if (!text.trim()) {
          console.log("Audio too short to transcribe. Skipping TTS.");
          socket.emit("audio_response", {
            from: to,
            to: from,
            audioBase64: null,
            mimeType: null,
            transcript: "",
          });
          return;
        }

        console.log("Transcript:", text);

        const ttsResponse = await deepgram.speak.request(
          { text },
          {
            model: "aura-luna-en",
            encoding: "linear16",
            container: "wav",
            sample_rate: 48000,
          },
        );

        const stream = await ttsResponse.getStream();
        if (!stream) throw new Error("Failed to get TTS audio stream");

        const chunks: any[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const ttsAudioBuffer = Buffer.concat(chunks);

        const ttsAudioBase64 = ttsAudioBuffer.toString("base64");

        socket.emit("audio_response", {
          from: to,
          to: from,
          audioBase64: ttsAudioBase64,
          mimeType: "audio/wav",
          transcript: text,
        });

        console.log("TTS audio sent successfully");
      } catch (err: any) {
        console.log("Error:", err);
        socket.emit("error", { message: err.message });
      }
    });
  });
};
