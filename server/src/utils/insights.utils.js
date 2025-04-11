// src/utils/insights.utils.js
import prisma from "../db.js";

/**
 * Generate personalized spending insights for a user
 */
export const generateSpendingInsights = async (userId) => {
	try {
		const insights = [];

		// Get user's groups
		const userGroups = await prisma.groupMember.findMany({
			where: { userId },
			select: { groupId: true },
		});

		const groupIds = userGroups.map((g) => g.groupId);

		// Skip insights if user is not in any groups
		if (groupIds.length === 0) {
			return [
				{
					type: "info",
					message: "Join a group to start tracking expenses and see insights",
				},
			];
		}

		// Get expenses where user is involved
		const expenses = await prisma.expense.findMany({
			where: {
				groupId: { in: groupIds },
				OR: [
					{ paidById: userId },
					{
						shares: {
							some: { userId },
						},
					},
				],
			},
			include: {
				shares: {
					where: { userId },
				},
				group: {
					select: { name: true },
				},
			},
			orderBy: { createdAt: "desc" },
		});

		// Skip insights if no expenses
		if (expenses.length === 0) {
			return [
				{
					type: "info",
					message: "Add some expenses to see personalized insights",
				},
			];
		}

		// Get top spending category
		const categorySpending = {};
		let totalSpent = 0;

		expenses.forEach((expense) => {
			const userShare = expense.shares[0]?.amount || 0;
			totalSpent += userShare;

			const category = expense.category || "Uncategorized";
			if (!categorySpending[category]) {
				categorySpending[category] = 0;
			}
			categorySpending[category] += userShare;
		});

		// Find top category
		let topCategory = null;
		let topAmount = 0;

		Object.entries(categorySpending).forEach(([category, amount]) => {
			if (amount > topAmount) {
				topCategory = category;
				topAmount = amount;
			}
		});

		if (topCategory) {
			const percentage = Math.round((topAmount / totalSpent) * 100);
			let emoji = getCategoryEmoji(topCategory);

			insights.push({
				type: "spending",
				message: `Your biggest expense category is ${topCategory} (${percentage}%) ${emoji}`,
			});
		}

		// See if user paid more than their fair share
		const totalPaid = expenses
			.filter((e) => e.paidById === userId)
			.reduce((sum, e) => sum + e.amount, 0);

		if (totalPaid - totalSpent > 10) {
			insights.push({
				type: "balance",
				message: `You've paid ${formatCurrency(
					totalPaid - totalSpent
				)} more than your share. Time to collect! 💰`,
			});
		} else if (totalSpent - totalPaid > 10) {
			insights.push({
				type: "balance",
				message: `You owe ${formatCurrency(
					totalSpent - totalPaid
				)} to your groups. Consider settling up soon! 💸`,
			});
		}

		// Check recent activity
		const recentExpenses = expenses.filter((e) => {
			const expenseDate = new Date(e.createdAt);
			const weekAgo = new Date();
			weekAgo.setDate(weekAgo.getDate() - 7);
			return expenseDate > weekAgo;
		});

		if (recentExpenses.length >= 5) {
			insights.push({
				type: "activity",
				message: `Busy week! You had ${recentExpenses.length} expenses in the last 7 days`,
			});
		}

		// Check for groups with no recent activity
		const groupActivity = {};
		groupIds.forEach((id) => {
			groupActivity[id] = 0;
		});

		expenses.forEach((expense) => {
			const expenseDate = new Date(expense.createdAt);
			const monthAgo = new Date();
			monthAgo.setDate(monthAgo.getDate() - 30);

			if (expenseDate > monthAgo) {
				groupActivity[expense.groupId]++;
			}
		});

		// Find inactive groups
		const inactiveGroups = await prisma.group.findMany({
			where: {
				id: {
					in: Object.entries(groupActivity)
						.filter(([_, count]) => count === 0)
						.map(([id]) => id),
				},
			},
			select: {
				name: true,
			},
		});

		if (inactiveGroups.length === 1) {
			insights.push({
				type: "activity",
				message: `No expenses in "${inactiveGroups[0].name}" for a month. Group still active?`,
			});
		} else if (inactiveGroups.length > 1) {
			insights.push({
				type: "activity",
				message: `You have ${inactiveGroups.length} groups with no activity in the last month`,
			});
		}

		// Limit to 3 insights
		return insights.slice(0, 3);
	} catch (error) {
		console.error("Error generating insights:", error);
		return [
			{
				type: "error",
				message: "Unable to generate insights at this time",
			},
		];
	}
};

/**
 * Get an appropriate emoji for expense category
 */
const getCategoryEmoji = (category) => {
	const emojiMap = {
		"Food & Dining": "🍽️",
		Groceries: "🛒",
		Transportation: "🚗",
		Entertainment: "🎬",
		Shopping: "🛍️",
		Utilities: "💡",
		Rent: "🏠",
		Travel: "✈️",
		Healthcare: "🏥",
		Education: "📚",
		"Personal Care": "💇",
		"Gifts & Donations": "🎁",
		Business: "💼",
		"Home Improvement": "🔨",
		Insurance: "🛡️",
		Taxes: "📝",
		"Fees & Charges": "💰",
	};

	return emojiMap[category] || "💵";
};

/**
 * Format currency for display
 */
const formatCurrency = (amount) => {
	return `$${amount.toFixed(2)}`;
};
