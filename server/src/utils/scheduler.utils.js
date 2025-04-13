// src/utils/scheduler.utils.js

import prisma from "../db.js";
import { sendBillReminders } from "../services/bill-reminder.service.js";
import { sendPaymentReminders } from "../services/payment.service.js";

/**
 * Run scheduled tasks
 * This can be called by a cron job or when the server starts
 */
export const runScheduledTasks = async (io) => {
	try {
		console.log("Running scheduled tasks...");

		// Get all active groups
		const groups = await prisma.group.findMany({
			select: { id: true },
		});

		// Process bill reminders for each group
		for (const group of groups) {
			try {
				// Process bill reminders
				const billReminders = await sendBillReminders(group.id);

				// Send real-time notifications
				billReminders.forEach((reminder) => {
					io.to(`group:${group.id}`).emit("bill-reminder", {
						bill: reminder.bill,
						sentAt: reminder.sentAt,
					});
				});

				// Process payment reminders
				const paymentReminders = await sendPaymentReminders(group.id);

				// Send real-time notifications for payment reminders
				paymentReminders.forEach((reminder) => {
					const share = reminder.expenseShare;

					// Notify the user who needs to pay
					io.to(`user:${share.userId}`).emit("payment-reminder", {
						expenseId: share.expenseId,
						description: share.expense.description,
						amount: share.amount,
						groupId: share.expense.groupId,
					});
				});

				console.log(
					`Processed ${billReminders.length} bill reminders and ${paymentReminders.length} payment reminders for group ${group.id}`
				);
			} catch (error) {
				console.error(
					`Error processing reminders for group ${group.id}:`,
					error
				);
			}
		}

		console.log("Scheduled tasks completed");
	} catch (error) {
		console.error("Error running scheduled tasks:", error);
	}
};

/**
 * Start the scheduler - runs once a day
 */
export const startScheduler = (io) => {
	// Run immediately on startup
	runScheduledTasks(io);

	// Then run once a day
	const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;
	setInterval(() => runScheduledTasks(io), MILLISECONDS_IN_DAY);

	console.log("Scheduler started");
};
