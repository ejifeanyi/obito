// src/controllers/bill-reminder.controller.js
import {
	analyzeGroupExpenses,
	createRecurringBill,
	updateRecurringBill,
	deleteRecurringBill,
	getGroupRecurringBills,
	sendBillReminders,
} from "../services/bill-reminder.service.js";

// Analyze group expenses to find recurring patterns
export const analyzeExpenses = async (req, res) => {
	try {
		const { groupId } = req.params;
		const userId = req.user.id;

		const results = await analyzeGroupExpenses(groupId, userId);

		res.json({
			message: "Expense analysis completed",
			detected: results.detected,
			saved: results.saved,
		});
	} catch (error) {
		console.error("Analyze expenses error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while analyzing expenses" });
	}
};

// Create a new recurring bill
export const createBill = async (req, res) => {
	try {
		const billData = req.body;
		const userId = req.user.id;

		const bill = await createRecurringBill(billData, userId);

		// Emit real-time update
		req.io.to(`group:${billData.groupId}`).emit("new-bill", bill);

		res.status(201).json({
			message: "Recurring bill created successfully",
			bill,
		});
	} catch (error) {
		console.error("Create bill error:", error);
		res
			.status(500)
			.json({
				error: error.message || "An error occurred while creating the bill",
			});
	}
};

// Update an existing recurring bill
export const updateBill = async (req, res) => {
	try {
		const { billId } = req.params;
		const billData = req.body;
		const userId = req.user.id;

		const bill = await updateRecurringBill(billId, billData, userId);

		// Emit real-time update
		req.io.to(`group:${bill.groupId}`).emit("update-bill", bill);

		res.json({
			message: "Recurring bill updated successfully",
			bill,
		});
	} catch (error) {
		console.error("Update bill error:", error);
		res
			.status(500)
			.json({
				error: error.message || "An error occurred while updating the bill",
			});
	}
};

// Delete a recurring bill
export const deleteBill = async (req, res) => {
	try {
		const { billId } = req.params;
		const userId = req.user.id;

		// Get the bill to check groupId before deletion
		const bill = await getRecurringBill(billId);
		const groupId = bill.groupId;

		await deleteRecurringBill(billId, userId);

		// Emit real-time update
		req.io.to(`group:${groupId}`).emit("delete-bill", { id: billId });

		res.json({ message: "Recurring bill deleted successfully" });
	} catch (error) {
		console.error("Delete bill error:", error);
		res
			.status(500)
			.json({
				error: error.message || "An error occurred while deleting the bill",
			});
	}
};

// Get a single recurring bill
export const getRecurringBill = async (billId) => {
	try {
		const bill = await prisma.recurringBill.findUnique({
			where: { id: billId },
		});

		if (!bill) {
			throw new Error("Bill not found");
		}

		return bill;
	} catch (error) {
		console.error("Get recurring bill error:", error);
		throw error;
	}
};

// Get all recurring bills for a group
export const getGroupBills = async (req, res) => {
	try {
		const { groupId } = req.params;
		const userId = req.user.id;

		const bills = await getGroupRecurringBills(groupId, userId);

		res.json({ bills });
	} catch (error) {
		console.error("Get group bills error:", error);
		res
			.status(500)
			.json({
				error: error.message || "An error occurred while fetching bills",
			});
	}
};

// Send reminders for upcoming bills
export const sendReminders = async (req, res) => {
	try {
		const { groupId } = req.params;
		const userId = req.user.id;

		// Check if user is a member/admin of the group
		const membership = await prisma.groupMember.findUnique({
			where: {
				userId_groupId: {
					userId,
					groupId,
				},
			},
		});

		if (!membership) {
			return res
				.status(403)
				.json({ error: "You are not a member of this group" });
		}

		const reminders = await sendBillReminders(groupId);

		// Emit real-time notifications for reminders
		reminders.forEach((reminder) => {
			req.io.to(`group:${groupId}`).emit("bill-reminder", {
				bill: reminder.bill,
				sentAt: reminder.sentAt,
			});
		});

		res.json({
			message: `${reminders.length} reminders sent successfully`,
			reminders,
		});
	} catch (error) {
		console.error("Send reminders error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while sending reminders" });
	}
};
