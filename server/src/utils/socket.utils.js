// src/utils/socket.utils.js
import { Server } from "socket.io";
import { verifyToken } from "./token.utils.js";

export const setupSocketIO = (server) => {
	const io = new Server(server, {
		cors: {
			origin: process.env.CLIENT_URL || "*",
			methods: ["GET", "POST"],
		},
	});

	// Middleware to authenticate socket connections
	io.use(async (socket, next) => {
		try {
			const token = socket.handshake.auth.token;

			if (!token) {
				return next(new Error("Authentication error"));
			}

			// Verify the token
			const decoded = await verifyToken(token);

			if (!decoded) {
				return next(new Error("Invalid token"));
			}

			// Attach user data to socket
			socket.userId = decoded.userId;
			next();
		} catch (error) {
			console.error("Socket authentication error:", error);
			next(new Error("Authentication error"));
		}
	});

	io.on("connection", (socket) => {
		console.log(`User connected: ${socket.userId}`);

		// Join user to their private channel
		socket.join(`user:${socket.userId}`);

		// Join group channels
		socket.on("join-group", (groupId) => {
			if (typeof groupId === "string") {
				console.log(`User ${socket.userId} joined group ${groupId}`);
				socket.join(`group:${groupId}`);
			}
		});

		// Leave group channels
		socket.on("leave-group", (groupId) => {
			if (typeof groupId === "string") {
				console.log(`User ${socket.userId} left group ${groupId}`);
				socket.leave(`group:${groupId}`);
			}
		});

		socket.on("disconnect", () => {
			console.log(`User disconnected: ${socket.userId}`);
		});
	});

	return io;
};

// Middleware to attach io to request object
export const socketMiddleware = (io) => {
	return (req, res, next) => {
		req.io = io;
		next();
	};
};
