// src/routes/expense.routes.js
import express from "express";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
	createExpenseSchema,
	updateExpenseSchema,
} from "../validation/expense.validation.js";
import {
	createExpense,
	getGroupExpenses,
	getExpenseById,
	updateExpense,
	deleteExpense,
	getExpenseSummary,
	getGroupBalances,
} from "../controllers/expense.controller.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Create a new expense
router.post("/", validate(createExpenseSchema), createExpense);

// Get all expenses for a group
router.get("/group/:groupId", getGroupExpenses);

// Get expense summary by category
router.get("/group/:groupId/summary", getExpenseSummary);

// Get balances between group members
router.get("/group/:groupId/balances", getGroupBalances);

// Get, update, delete specific expense
router.get("/:expenseId", getExpenseById);
router.put("/:expenseId", validate(updateExpenseSchema), updateExpense);
router.delete("/:expenseId", deleteExpense);

export default router;
