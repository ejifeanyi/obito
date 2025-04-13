// src/routes/payment.routes.js
import express from "express";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import {
	initiatePayment,
	handleStripeWebhook,
	getUnpaidShares,
	sendReminders,
} from "../controllers/payment.controller.js";

const router = express.Router();

// Webhook doesn't need authentication
router.post(
	"/webhook",
	express.raw({ type: "application/json" }),
	handleStripeWebhook
);

// All other routes require authentication
router.use(authenticateToken);

// Create a payment intent
router.post("/initiate", initiatePayment);

// Get all unpaid expense shares for the user
router.get("/unpaid", getUnpaidShares);

// Send payment reminders for a group
router.post("/groups/:groupId/reminders", sendReminders);

export default router;
