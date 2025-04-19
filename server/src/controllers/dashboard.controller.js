// src/controllers/dashboard.controller.js
import prisma from "../db.js";
import { generateSpendingInsights } from "../utils/insights.utils.js";

/**
 * Get a user's dashboard summary across all groups
 */
export const getUserDashboard = async (req, res) => {
	try {
		const userId = req.user.id;

		// Get groups the user is a member of
		const userGroups = await prisma.groupMember.findMany({
			where: { userId },
			include: {
				group: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		});

		const groupIds = userGroups.map((membership) => membership.groupId);

		// Get total outstanding balances across all groups
		const balanceSummary = await getBalanceSummary(userId, groupIds);

		// Get recent activity
		const recentActivity = await getRecentActivity(userId, groupIds);

		// Get spending insights
		const insights = await generateSpendingInsights(userId);

		res.json({
			summary: {
				totalOwed: balanceSummary.totalOwed,
				totalOwes: balanceSummary.totalOwes,
				netBalance: balanceSummary.netBalance,
			},
			recentActivity,
			insights,
			groups: userGroups.map((membership) => ({
				id: membership.group.id,
				name: membership.group.name,
			})),
		});
	} catch (error) {
		console.error("Dashboard error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while fetching dashboard data" });
	}
};

/**
 * Calculate total balances across specified groups
 */
const getBalanceSummary = async (userId, groupIds) => {
	// Get all expenses for the user's groups
	const expenses = await prisma.expense.findMany({
		where: {
			groupId: { in: groupIds },
		},
		include: {
			shares: true,
		},
	});

	let totalPaid = 0;
	let totalOwed = 0;

	// Process each expense
	expenses.forEach((expense) => {
		// If user paid for this expense
		if (expense.paidById === userId) {
			totalPaid += expense.amount;
		}

		// Find user's share in this expense
		const userShare = expense.shares.find((share) => share.userId === userId);
		if (userShare) {
			totalOwed += userShare.amount;
		}
	});

	return {
		totalPaid: parseFloat(totalPaid.toFixed(2)),
		totalOwed: parseFloat(totalOwed.toFixed(2)),
		netBalance: parseFloat((totalPaid - totalOwed).toFixed(2)),
	};
};

/**
 * Get recent activity across all user groups
 */
const getRecentActivity = async (userId, groupIds) => {
	// Get recent expenses
	const recentExpenses = await prisma.expense.findMany({
		where: {
			groupId: { in: groupIds },
		},
		include: {
			group: {
				select: {
					name: true,
				},
			},
			paidBy: {
				select: {
					id: true,
					firstName: true,
					lastName: true,
				},
			},
			shares: {
				where: {
					userId,
				},
			},
		},
		orderBy: {
			createdAt: "desc",
		},
		take: 5,
	});

	return recentExpenses.map((expense) => {
		const userShare = expense.shares[0]?.amount || 0;
		const isPayer = expense.paidById === userId;

		return {
			id: expense.id,
			description: expense.description,
			category: expense.category,
			date: expense.createdAt,
			groupName: expense.group.name,
			amount: expense.amount,
			userShare,
			paidBy: expense.paidBy,
			isPayer,
			impact: isPayer ? userShare - expense.amount : -userShare,
		};
	});
};

/**
 * Get detailed insights for a specific group
 */
export const getGroupDashboard = async (req, res) => {
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

		// Get group details with member count
		const group = await prisma.group.findUnique({
			where: { id: groupId },
			include: {
				_count: {
					select: { members: true },
				},
			},
		});

		// Get expense statistics
		const expenseStats = await getGroupExpenseStats(groupId);

		// Get member balances
		const memberBalances = await calculateMemberBalances(groupId);

		// Get settlement suggestions
		const settlements = generateSettlementSuggestions(memberBalances);

		res.json({
			group: {
				id: group.id,
				name: group.name,
				description: group.description,
				memberCount: group._count.members,
			},
			stats: expenseStats,
			balances: memberBalances,
			settlements,
		});
	} catch (error) {
		console.error("Group dashboard error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while fetching group dashboard" });
	}
};

/**
 * Calculate expense statistics for a group
 */
const getGroupExpenseStats = async (groupId) => {
	// Get total expense amount
	const totalResult = await prisma.expense.aggregate({
		where: { groupId },
		_sum: { amount: true },
		_count: true,
	});

	// Get recent expense activity
	const recentExpensesCount = await prisma.expense.count({
		where: {
			groupId,
			createdAt: {
				gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
			},
		},
	});

	// Get category breakdown
	const expenses = await prisma.expense.findMany({
		where: { groupId },
		select: {
			amount: true,
			category: true,
		},
	});

	// Calculate category totals
	const categoryTotals = {};
	let total = 0;

	expenses.forEach((expense) => {
		const category = expense.category || "Uncategorized";
		if (!categoryTotals[category]) {
			categoryTotals[category] = 0;
		}
		categoryTotals[category] += expense.amount;
		total += expense.amount;
	});

	// Find top categories
	const topCategories = Object.entries(categoryTotals)
		.map(([category, amount]) => ({
			category,
			amount,
			percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
		}))
		.sort((a, b) => b.amount - a.amount)
		.slice(0, 3);

	return {
		totalAmount: totalResult._sum.amount || 0,
		totalCount: totalResult._count || 0,
		recentActivity: recentExpensesCount,
		topCategories,
	};
};

/**
 * Calculate detailed balance information for all group members
 */
const calculateMemberBalances = async (groupId) => {
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

		// Format to 2 decimal places
		balances[userId].paid = parseFloat(balances[userId].paid.toFixed(2));
		balances[userId].owed = parseFloat(balances[userId].owed.toFixed(2));
		balances[userId].balance = parseFloat(balances[userId].balance.toFixed(2));
	});

	// Convert to array and sort by balance
	return Object.values(balances).sort((a, b) => b.balance - a.balance);
};

/**
 * Generate settlement suggestions to simplify debt repayment
 */
const generateSettlementSuggestions = (balances) => {
	const settlements = [];
	const debtors = [...balances]
		.filter((member) => member.balance < 0)
		.sort((a, b) => a.balance - b.balance); // Most negative first

	const creditors = [...balances]
		.filter((member) => member.balance > 0)
		.sort((a, b) => b.balance - a.balance); // Most positive first

	// Continue while there are members with negative balances
	while (debtors.length > 0 && creditors.length > 0) {
		const debtor = debtors[0];
		const creditor = creditors[0];

		// Calculate the transaction amount
		const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

		if (amount > 0.01) {
			// Only suggest meaningful amounts
			settlements.push({
				from: debtor.user,
				to: creditor.user,
				amount: parseFloat(amount.toFixed(2)),
			});
		}

		// Update balances
		debtor.balance += amount;
		creditor.balance -= amount;

		// Remove settled members
		if (Math.abs(debtor.balance) < 0.01) debtors.shift();
		if (Math.abs(creditor.balance) < 0.01) creditors.shift();
	}

	return settlements;
};
