// src/controllers/expense.controller.js
import { categorizeExpense } from "../utils/ai.utils.js";
import prisma from "../db.js";

// Create a new expense in a group
export const createExpense = async (req, res) => {
	try {
		const {
			groupId,
			amount,
			description,
			category,
			paidById,
			splitType,
			splitDetails,
		} = req.body;

		const userId = req.user.id;

		// Check if user is a member of the group
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

		// If no category is provided, use AI to categorize
		let expenseCategory = category;
		if (!expenseCategory) {
			expenseCategory = await categorizeExpense(description);
		}

		// Get all group members for splitting
		const groupMembers = await prisma.groupMember.findMany({
			where: { groupId },
			select: { userId: true },
		});

		const memberIds = groupMembers.map((member) => member.userId);

		// Validate paidById is a member of the group
		if (paidById && !memberIds.includes(paidById)) {
			return res
				.status(400)
				.json({ error: "Payer must be a member of the group" });
		}

		const actualPaidById = paidById || userId;

		// Process split logic
		let shares = [];

		if (splitType === "equal") {
			// Equal split among all members
			const shareAmount = parseFloat((amount / memberIds.length).toFixed(2));
			shares = memberIds.map((memberId) => ({
				userId: memberId,
				amount: shareAmount,
			}));

			// Handle rounding errors by adding remainder to the first member's share
			const totalShareAmount = shareAmount * memberIds.length;
			if (totalShareAmount !== amount && shares.length > 0) {
				const remainder = parseFloat((amount - totalShareAmount).toFixed(2));
				shares[0].amount = parseFloat(
					(shares[0].amount + remainder).toFixed(2)
				);
			}
		} else if (splitType === "custom" && Array.isArray(splitDetails)) {
			// Validate custom split details
			const totalSplitAmount = splitDetails.reduce(
				(sum, detail) => sum + detail.amount,
				0
			);

			// Ensure total split amount equals expense amount
			if (Math.abs(totalSplitAmount - amount) > 0.01) {
				return res.status(400).json({
					error: "Total split amount must equal expense amount",
					totalSplitAmount,
					expenseAmount: amount,
				});
			}

			// Ensure all users in split details are group members
			for (const detail of splitDetails) {
				if (!memberIds.includes(detail.userId)) {
					return res.status(400).json({
						error: `User ${detail.userId} is not a member of this group`,
					});
				}
			}

			shares = splitDetails;
		} else {
			return res.status(400).json({
				error: "Invalid split type. Must be 'equal' or 'custom'.",
			});
		}

		// Create expense and expense shares in a transaction
		const expense = await prisma.$transaction(async (tx) => {
			// Create the expense using tx
			const newExpense = await tx.expense.create({
				data: {
					amount,
					description,
					category: expenseCategory,
					paidById: actualPaidById,
					groupId,
					createdById: userId,
					splitType,
				},
			});

			// Create expense shares using tx
			for (const share of shares) {
				await tx.expenseShare.create({
					data: {
						expenseId: newExpense.id,
						userId: share.userId,
						amount: share.amount,
					},
				});
			}

			return newExpense;
		});

		// Get expense with shares
		const expenseWithShares = await prisma.expense.findUnique({
			where: { id: expense.id },
			include: {
				shares: {
					include: {
						user: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
							},
						},
					},
				},
				paidBy: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
					},
				},
			},
		});

		// Format response
		const formattedExpense = {
			id: expenseWithShares.id,
			amount: expenseWithShares.amount,
			description: expenseWithShares.description,
			category: expenseWithShares.category,
			splitType: expenseWithShares.splitType,
			createdAt: expenseWithShares.createdAt,
			paidBy: expenseWithShares.paidBy,
			shares: expenseWithShares.shares.map((share) => ({
				id: share.id,
				amount: share.amount,
				user: share.user,
			})),
		};

		// Emit real-time update through socket (handled in socket setup)
		req.io.to(`group:${groupId}`).emit("new-expense", formattedExpense);

		res.status(201).json({
			message: "Expense created successfully",
			expense: formattedExpense,
		});
	} catch (error) {
		console.error("Create expense error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while creating the expense" });
	}
};

// Update the updateExpense function to also use the tx parameter correctly
export const updateExpense = async (req, res) => {
	try {
		const { expenseId } = req.params;
		const { amount, description, category, paidById, splitType, splitDetails } =
			req.body;

		const userId = req.user.id;

		// Get expense to check permissions
		const expense = await prisma.expense.findUnique({
			where: { id: expenseId },
			include: {
				group: {
					include: {
						members: true,
					},
				},
			},
		});

		if (!expense) {
			return res.status(404).json({ error: "Expense not found" });
		}

		// Check if user is creator or admin
		const userMembership = expense.group.members.find(
			(member) => member.userId === userId
		);

		if (!userMembership) {
			return res
				.status(403)
				.json({ error: "You are not a member of this group" });
		}

		const isAdmin = userMembership.role === "admin";
		const isCreator = expense.createdById === userId;

		if (!isAdmin && !isCreator) {
			return res.status(403).json({
				error: "Only expense creator or group admin can update the expense",
			});
		}

		// Get group members for validation
		const memberIds = expense.group.members.map((member) => member.userId);

		// Validate paidById if provided
		if (paidById && !memberIds.includes(paidById)) {
			return res
				.status(400)
				.json({ error: "Payer must be a member of the group" });
		}

		let expenseCategory = category;
		if (!expenseCategory && description) {
			// If description is updated but category is not, recategorize
			expenseCategory = await categorizeExpense(description);
		}

		// Process split logic if provided
		let shares = [];

		if (splitType && splitDetails) {
			if (splitType === "equal") {
				// Equal split among all members
				const shareAmount = parseFloat((amount / memberIds.length).toFixed(2));
				shares = memberIds.map((memberId) => ({
					userId: memberId,
					amount: shareAmount,
				}));

				// Handle rounding errors
				const totalShareAmount = shareAmount * memberIds.length;
				if (totalShareAmount !== amount && shares.length > 0) {
					const remainder = parseFloat((amount - totalShareAmount).toFixed(2));
					shares[0].amount = parseFloat(
						(shares[0].amount + remainder).toFixed(2)
					);
				}
			} else if (splitType === "custom" && Array.isArray(splitDetails)) {
				// Validate custom split details
				const totalSplitAmount = splitDetails.reduce(
					(sum, detail) => sum + detail.amount,
					0
				);

				// Ensure total split amount equals expense amount
				if (Math.abs(totalSplitAmount - amount) > 0.01) {
					return res.status(400).json({
						error: "Total split amount must equal expense amount",
						totalSplitAmount,
						expenseAmount: amount,
					});
				}

				// Ensure all users in split details are group members
				for (const detail of splitDetails) {
					if (!memberIds.includes(detail.userId)) {
						return res.status(400).json({
							error: `User ${detail.userId} is not a member of this group`,
						});
					}
				}

				shares = splitDetails;
			} else {
				return res.status(400).json({
					error: "Invalid split type. Must be 'equal' or 'custom'.",
				});
			}
		}

		// Update expense and shares in a transaction
		const updatedExpense = await prisma.$transaction(async (tx) => {
			// Update the expense
			const newExpense = await tx.expense.update({
				where: { id: expenseId },
				data: {
					...(amount && { amount }),
					...(description && { description }),
					...(expenseCategory && { category: expenseCategory }),
					...(paidById && { paidById }),
					...(splitType && { splitType }),
				},
			});

			// If we're updating the split, replace all shares
			if (shares.length > 0) {
				// Delete existing shares
				await tx.expenseShare.deleteMany({
					where: { expenseId },
				});

				// Create new shares
				for (const share of shares) {
					await tx.expenseShare.create({
						data: {
							expenseId,
							userId: share.userId,
							amount: share.amount,
						},
					});
				}
			}

			return newExpense;
		});

		// Get updated expense with shares
		const expenseWithShares = await prisma.expense.findUnique({
			where: { id: updatedExpense.id },
			include: {
				shares: {
					include: {
						user: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
							},
						},
					},
				},
				paidBy: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
					},
				},
			},
		});

		// Format response
		const formattedExpense = {
			id: expenseWithShares.id,
			amount: expenseWithShares.amount,
			description: expenseWithShares.description,
			category: expenseWithShares.category,
			splitType: expenseWithShares.splitType,
			updatedAt: expenseWithShares.updatedAt,
			paidBy: expenseWithShares.paidBy,
			shares: expenseWithShares.shares.map((share) => ({
				id: share.id,
				amount: share.amount,
				user: share.user,
			})),
		};

		// Emit real-time update
		req.io
			.to(`group:${expense.groupId}`)
			.emit("update-expense", formattedExpense);

		res.json({
			message: "Expense updated successfully",
			expense: formattedExpense,
		});
	} catch (error) {
		console.error("Update expense error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while updating the expense" });
	}
};

// Get all expenses for a group
export const getGroupExpenses = async (req, res) => {
	try {
		const { groupId } = req.params;
		const userId = req.user.id;

		// Check if user is a member of the group
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

		// Pagination parameters
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		// Get expenses with shares
		const expenses = await prisma.expense.findMany({
			where: { groupId },
			include: {
				shares: {
					include: {
						user: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
							},
						},
					},
				},
				paidBy: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
					},
				},
			},
			orderBy: { createdAt: "desc" },
			skip,
			take: limit,
		});

		// Get total count for pagination
		const total = await prisma.expense.count({
			where: { groupId },
		});

		// Format response
		const formattedExpenses = expenses.map((expense) => ({
			id: expense.id,
			amount: expense.amount,
			description: expense.description,
			category: expense.category,
			splitType: expense.splitType,
			createdAt: expense.createdAt,
			paidBy: expense.paidBy,
			shares: expense.shares.map((share) => ({
				id: share.id,
				amount: share.amount,
				user: share.user,
			})),
		}));

		res.json({
			expenses: formattedExpenses,
			pagination: {
				total,
				page,
				limit,
				pages: Math.ceil(total / limit),
			},
		});
	} catch (error) {
		console.error("Get group expenses error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while fetching expenses" });
	}
};

// Get expense details by ID
export const getExpenseById = async (req, res) => {
	try {
		const { expenseId } = req.params;
		const userId = req.user.id;

		// Get expense with shares
		const expense = await prisma.expense.findUnique({
			where: { id: expenseId },
			include: {
				shares: {
					include: {
						user: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
							},
						},
					},
				},
				paidBy: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
					},
				},
				group: true,
			},
		});

		if (!expense) {
			return res.status(404).json({ error: "Expense not found" });
		}

		// Check if user is a member of the group
		const membership = await prisma.groupMember.findUnique({
			where: {
				userId_groupId: {
					userId,
					groupId: expense.groupId,
				},
			},
		});

		if (!membership) {
			return res
				.status(403)
				.json({ error: "You are not a member of this group" });
		}

		// Format response
		const formattedExpense = {
			id: expense.id,
			amount: expense.amount,
			description: expense.description,
			category: expense.category,
			splitType: expense.splitType,
			createdAt: expense.createdAt,
			groupId: expense.groupId,
			groupName: expense.group.name,
			paidBy: expense.paidBy,
			shares: expense.shares.map((share) => ({
				id: share.id,
				amount: share.amount,
				user: share.user,
			})),
		};

		res.json({ expense: formattedExpense });
	} catch (error) {
		console.error("Get expense error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while fetching the expense" });
	}
};

// Delete an expense
export const deleteExpense = async (req, res) => {
	try {
		const { expenseId } = req.params;
		const userId = req.user.id;

		// Get expense to check permissions
		const expense = await prisma.expense.findUnique({
			where: { id: expenseId },
			include: {
				group: {
					include: {
						members: true,
					},
				},
			},
		});

		if (!expense) {
			return res.status(404).json({ error: "Expense not found" });
		}

		// Check if user is creator or admin
		const userMembership = expense.group.members.find(
			(member) => member.userId === userId
		);

		if (!userMembership) {
			return res
				.status(403)
				.json({ error: "You are not a member of this group" });
		}

		const isAdmin = userMembership.role === "admin";
		const isCreator = expense.createdById === userId;

		if (!isAdmin && !isCreator) {
			return res.status(403).json({
				error: "Only expense creator or group admin can delete the expense",
			});
		}

		// Delete expense (shares will be cascade deleted)
		await prisma.expense.delete({
			where: { id: expenseId },
		});

		// Emit real-time update
		req.io
			.to(`group:${expense.groupId}`)
			.emit("delete-expense", { id: expenseId });

		res.json({ message: "Expense deleted successfully" });
	} catch (error) {
		console.error("Delete expense error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while deleting the expense" });
	}
};

// Get expense summary by category for a group
export const getExpenseSummary = async (req, res) => {
	try {
		const { groupId } = req.params;
		const userId = req.user.id;

		// Period can be 'all', 'month', 'week'
		const period = req.query.period || "month";

		// Check if user is a member of the group
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

		// Calculate date range based on period
		let dateFilter = {};
		const now = new Date();

		if (period === "month") {
			const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
			dateFilter = { gte: firstDayOfMonth };
		} else if (period === "week") {
			const firstDayOfWeek = new Date(now);
			firstDayOfWeek.setDate(now.getDate() - now.getDay());
			firstDayOfWeek.setHours(0, 0, 0, 0);
			dateFilter = { gte: firstDayOfWeek };
		}

		// Get expenses grouped by category
		const expenses = await prisma.expense.findMany({
			where: {
				groupId,
				...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
			},
			select: {
				amount: true,
				category: true,
			},
		});

		// Calculate total by category
		const summary = {};
		let total = 0;

		expenses.forEach((expense) => {
			const category = expense.category || "Uncategorized";
			if (!summary[category]) {
				summary[category] = 0;
			}
			summary[category] += expense.amount;
			total += expense.amount;
		});

		// Convert to array format
		const categorySummary = Object.entries(summary).map(
			([category, amount]) => ({
				category,
				amount,
				percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
			})
		);

		// Sort by amount descending
		categorySummary.sort((a, b) => b.amount - a.amount);

		res.json({
			period,
			total,
			categories: categorySummary,
		});
	} catch (error) {
		console.error("Get expense summary error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while fetching expense summary" });
	}
};

// Get balances between group members
export const getGroupBalances = async (req, res) => {
	try {
		const { groupId } = req.params;
		const userId = req.user.id;

		// Check if user is a member of the group
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

		// Get all group members
		const groupMembers = await prisma.groupMember.findMany({
			where: { groupId },
			include: {
				user: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
					},
				},
			},
		});

		// Get all expenses for the group
		const expenses = await prisma.expense.findMany({
			where: { groupId },
			include: {
				shares: true,
			},
		});

		// Calculate balances
		const balances = {};

		// Initialize balances for all members
		groupMembers.forEach((member) => {
			balances[member.user.id] = {
				user: member.user,
				paid: 0,
				owed: 0,
				balance: 0,
			};
		});

		// Process each expense
		expenses.forEach((expense) => {
			const paidById = expense.paidById;

			// Add to payer's paid amount
			if (balances[paidById]) {
				balances[paidById].paid += expense.amount;
			}

			// Add to each member's owed amount based on shares
			expense.shares.forEach((share) => {
				if (balances[share.userId]) {
					balances[share.userId].owed += share.amount;
				}
			});
		});

		// Calculate net balance for each member
		Object.keys(balances).forEach((userId) => {
			balances[userId].balance = balances[userId].paid - balances[userId].owed;
		});

		// Convert to array and sort by balance
		const balanceArray = Object.values(balances).map((balance) => ({
			...balance,
			paid: parseFloat(balance.paid.toFixed(2)),
			owed: parseFloat(balance.owed.toFixed(2)),
			balance: parseFloat(balance.balance.toFixed(2)),
		}));

		// Sort by balance descending
		balanceArray.sort((a, b) => b.balance - a.balance);

		res.json({ balances: balanceArray });
	} catch (error) {
		console.error("Get group balances error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while calculating balances" });
	}
};
