// src/app.js
import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes.js";
import groupRoutes from "./routes/group.routes.js";
import expenseRoutes from "./routes/expense.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

import { setupSocketIO, socketMiddleware } from "./utils/socket.utils.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = setupSocketIO(server);

app.use(cors());
app.use(express.json());
app.use(socketMiddleware(io));

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/", (req, res) => {
	res.send("Welcome to my Express app!");
});

export { app, server };
