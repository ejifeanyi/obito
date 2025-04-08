// src/app.js
import express from "express";

const app = express();

// Middleware
app.use(express.json());

// Routes
app.get("/", (req, res) => {
	res.send("Welcome to my Express app!");
});

// Export the app so index.js can use it
export { app };
