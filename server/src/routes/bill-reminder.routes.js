// src/routes/bill-reminder.routes.js
import express from "express";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import {
	analyzeExpenses,
	createBill,
	updateBill,
	deleteBill,
	getGroupBills,
	sendReminders,
} from "../controllers/bill-reminder.controller.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Analyze expenses to find recurring bills
router.post("/groups/:groupId/analyze", analyzeExpenses);

// Get all recurring bills for a group
router.get("/groups/:groupId/bills", getGroupBills);

// Create a new recurring bill
router.post("/bills", createBill);

// Update a recurring bill
router.put("/bills/:billId", updateBill);

// Delete a recurring bill
router.delete("/bills/:billId", deleteBill);

// Send reminders for upcoming bills
router.post("/groups/:groupId/send-reminders", sendReminders);

export default router;
