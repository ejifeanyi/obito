// src/app.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes.js";
import groupRoutes from "./routes/group.routes.js";

const app = express();

dotenv.config();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);

// Routes
app.get("/", (req, res) => {
	res.send("Welcome to my Express app!");
});

export { app };
