import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import messageRoutes from "./routes/messages.routes";
import connectDB from "./config/connection";
import dotenv from "dotenv";
import { readTextFile, splitChunk, storeDocuments } from "./utils/helpers";
dotenv.config();
connectDB();
export const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/login", authRoutes);
app.use("/users", userRoutes);
app.use("/messages", messageRoutes);
app.post("/upload", async (req, res) => {
  try {
    const text = readTextFile("knowledge_base.txt");
    console.log(text, "text");
    const chunks = splitChunk(text);
    console.log(chunks, "chunks");
    console.log("Chunks:", chunks.length);
    await storeDocuments(chunks);
    res.json({ success: true });
  } catch (error) {
    console.log(error);
  }
});
