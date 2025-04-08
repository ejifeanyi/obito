// src/routes/auth.routes.js
import express from "express";
import {
	signup,
	login,
	refreshToken,
	logout,
	googleAuth,
	getMe,
} from "../controllers/auth.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.post("/google", googleAuth);
router.get("/me", authenticateToken, getMe);

export default router;
