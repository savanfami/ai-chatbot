import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import messageRoutes from "./routes/messages.routes";
import connectDB from "./config/connection";
import dotenv from "dotenv";
dotenv.config();
connectDB();
export const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/login", authRoutes);
app.use("/users", userRoutes);
app.use("/messages", messageRoutes);
