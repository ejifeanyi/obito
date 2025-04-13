// src/services/bill-reminder.service.js
import prisma from "../db.js";
import {
	detectRecurringExpenses,
	generateBillName,
} from "../utils/bill-predictor.utils.js";

/**
 * Analyze group expenses to find and save recurring bills
 * @param {string} groupId - The group ID
 * @param {string} userId - The user ID who requested the analysis
 * @returns {Promise<Object>} - Analysis results
 */
export const analyzeGroupExpenses = async (groupId, userId) => {
	try {
		// Detect recurring patterns
		const recurringPatterns = await detectRecurringExpenses(groupId);
		const results = { detected: [], saved: [] };

		// For each detected pattern, create or update a recurring bill
		for (const pattern of recurringPatterns) {
			if (pattern.confidence >= 70) {
				// Generate a name for the bill if none exists
				const billName = await generateBillName(pattern.description);

				// Check if a similar bill already exists
				const existingBill = await prisma.recurringBill.findFirst({
					where: {
						groupId,
						category: pattern.category,
						// Find bills with similar amounts (within 10%)
						amount: {
							gte: pattern.amount * 0.9,
							lte: pattern.amount * 1.1,
						},
						// With similar description
						description: {
							contains: pattern.description,
						},
					},
				});

				if (existingBill) {
					// Update existing bill with new prediction
					const updatedBill = await prisma.recurringBill.update({
						where: { id: existingBill.id },
						data: {
							nextDueDate: pattern.nextDueDate,
							frequency: pattern.frequency,
							updatedAt: new Date(),
						},
					});
					results.saved.push(updatedBill);
				} else {
					// Create new recurring bill
					const newBill = await prisma.recurringBill.create({
						data: {
							name: billName,
							description: pattern.description,
							amount: pattern.amount,
							category: pattern.category,
							frequency: pattern.frequency,
							nextDueDate: pattern.nextDueDate,
							groupId,
							createdById: userId,
						},
					});
					results.saved.push(newBill);
				}
			} else {
				// Low confidence patterns are returned but not saved
				results.detected.push({
					description: pattern.description,
					amount: pattern.amount,
					category: pattern.category,
					frequency: pattern.frequency,
					nextDueDate: pattern.nextDueDate,
					confidence: pattern.confidence,
				});
			}
		}

		return results;
	} catch (error) {
		console.error("Error analyzing group expenses:", error);
		throw error;
	}
};

/**
 * Create a new recurring bill manually
 * @param {Object} billData - Bill details
 * @param {string} userId - User creating the bill
 * @returns {Promise<Object>} - Created bill
 */
export const createRecurringBill = async (billData, userId) => {
	try {
		const {
			groupId,
			name,
			description,
			amount,
			category,
			frequency,
			nextDueDate,
		} = billData;

		// Validate that the user is a member of the group
		const membership = await prisma.groupMember.findUnique({
			where: {
				userId_groupId: {
					userId,
					groupId,
				},
			},
		});

		if (!membership) {
			throw new Error("User is not a member of this group");
		}

		// Create the bill
		const bill = await prisma.recurringBill.create({
			data: {
				name,
				description,
				amount,
				category,
				frequency,
				nextDueDate: new Date(nextDueDate),
				groupId,
				createdById: userId,
			},
		});

		return bill;
	} catch (error) {
		console.error("Error creating recurring bill:", error);
		throw error;
	}
};

/**
 * Update a recurring bill
 * @param {string} billId - Bill ID
 * @param {Object} billData - Bill details to update
 * @param {string} userId - User updating the bill
 * @returns {Promise<Object>} - Updated bill
 */
export const updateRecurringBill = async (billId, billData, userId) => {
	try {
		// Get the bill to verify permissions
		const bill = await prisma.recurringBill.findUnique({
			where: { id: billId },
			include: {
				group: {
					include: {
						members: true,
					},
				},
			},
		});

		if (!bill) {
			throw new Error("Bill not found");
		}

		// Check if user has permission (is bill creator or group admin)
		const userMembership = bill.group.members.find(
			(member) => member.userId === userId
		);
		if (!userMembership) {
			throw new Error("User is not a member of this group");
		}

		const isAdmin = userMembership.role === "admin";
		const isCreator = bill.createdById === userId;

		if (!isAdmin && !isCreator) {
			throw new Error("User does not have permission to update this bill");
		}

		// Update the bill
		const updatedBill = await prisma.recurringBill.update({
			where: { id: billId },
			data: {
				...billData,
				...(billData.nextDueDate && {
					nextDueDate: new Date(billData.nextDueDate),
				}),
			},
		});

		return updatedBill;
	} catch (error) {
		console.error("Error updating recurring bill:", error);
		throw error;
	}
};

/**
 * Delete a recurring bill
 * @param {string} billId - Bill ID
 * @param {string} userId - User deleting the bill
 * @returns {Promise<void>}
 */
export const deleteRecurringBill = async (billId, userId) => {
	try {
		// Get the bill to verify permissions
		const bill = await prisma.recurringBill.findUnique({
			where: { id: billId },
			include: {
				group: {
					include: {
						members: true,
					},
				},
			},
		});

		if (!bill) {
			throw new Error("Bill not found");
		}

		// Check if user has permission (is bill creator or group admin)
		const userMembership = bill.group.members.find(
			(member) => member.userId === userId
		);
		if (!userMembership) {
			throw new Error("User is not a member of this group");
		}

		const isAdmin = userMembership.role === "admin";
		const isCreator = bill.createdById === userId;

		if (!isAdmin && !isCreator) {
			throw new Error("User does not have permission to delete this bill");
		}

		// Delete the bill
		await prisma.recurringBill.delete({
			where: { id: billId },
		});
	} catch (error) {
		console.error("Error deleting recurring bill:", error);
		throw error;
	}
};

/**
 * Get all recurring bills for a group
 * @param {string} groupId - The group ID
 * @param {string} userId - User requesting the bills
 * @returns {Promise<Array>} - List of bills
 */
export const getGroupRecurringBills = async (groupId, userId) => {
	try {
		// Verify user is a member of the group
		const membership = await prisma.groupMember.findUnique({
			where: {
				userId_groupId: {
					userId,
					groupId,
				},
			},
		});

		if (!membership) {
			throw new Error("User is not a member of this group");
		}

		// Get all bills for the group
		const bills = await prisma.recurringBill.findMany({
			where: { groupId },
			orderBy: { nextDueDate: "asc" },
			include: {
				createdBy: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
					},
				},
			},
		});

		return bills;
	} catch (error) {
		console.error("Error getting group recurring bills:", error);
		throw error;
	}
};

/**
 * Send bill reminders to a group
 * @param {string} groupId - Group ID
 * @returns {Promise<Array>} - Sent reminders
 */
export const sendBillReminders = async (groupId) => {
	try {
		// Get bills due in the next 3 days
		const threeDaysFromNow = new Date();
		threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

		const dueBills = await prisma.recurringBill.findMany({
			where: {
				groupId,
				nextDueDate: {
					lte: threeDaysFromNow,
				},
			},
			include: {
				reminders: {
					orderBy: {
						sentAt: "desc",
					},
					take: 1,
				},
			},
		});

		const sentReminders = [];

		for (const bill of dueBills) {
			// Check if we already sent a reminder recently (in the past 24 hours)
			const hasRecentReminder =
				bill.reminders.length > 0 &&
				new Date() - bill.reminders[0].sentAt < 24 * 60 * 60 * 1000;

			if (!hasRecentReminder) {
				// Create a reminder record
				const reminder = await prisma.billReminder.create({
					data: {
						billId: bill.id,
						status: "sent",
					},
				});

				// Update the bill's next due date if it's past due
				if (bill.nextDueDate < new Date()) {
					await updateNextDueDate(bill);
				}

				sentReminders.push({
					...reminder,
					bill,
				});
			}
		}

		return sentReminders;
	} catch (error) {
		console.error("Error sending bill reminders:", error);
		throw error;
	}
};

/**
 * Update the next due date for a recurring bill
 * @param {Object} bill - The bill to update
 * @returns {Promise<void>}
 */
async function updateNextDueDate(bill) {
	const nextDueDate = new Date(bill.nextDueDate);

	// Calculate next due date based on frequency
	switch (bill.frequency) {
		case "weekly":
			nextDueDate.setDate(nextDueDate.getDate() + 7);
			break;
		case "biweekly":
			nextDueDate.setDate(nextDueDate.getDate() + 14);
			break;
		case "monthly":
			nextDueDate.setMonth(nextDueDate.getMonth() + 1);
			break;
		case "quarterly":
			nextDueDate.setMonth(nextDueDate.getMonth() + 3);
			break;
		case "yearly":
			nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
			break;
	}

	// Update the bill
	await prisma.recurringBill.update({
		where: { id: bill.id },
		data: { nextDueDate },
	});
}
