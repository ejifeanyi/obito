// src/utils/bill-predictor.utils.js
import axios from "axios";

/**
 * Detect recurring expenses in a group's expense history
 * @param {string} groupId - The group ID
 * @returns {Promise<Array>} - Array of detected recurring expense patterns
 */
export const detectRecurringExpenses = async (groupId) => {
	try {
		// Get all expenses for the group
		const expenses = await prisma.expense.findMany({
			where: { groupId },
			orderBy: { createdAt: "asc" },
			select: {
				id: true,
				amount: true,
				description: true,
				category: true,
				createdAt: true,
			},
		});

		// Group expenses by similar descriptions and amounts
		const groupedExpenses = {};
		expenses.forEach((expense) => {
			// Create a key based on similar amounts (within 5%) and similar descriptions
			const amountKey = Math.round(expense.amount);
			const descriptionWords = expense.description.toLowerCase().split(" ");
			const keyWords = descriptionWords
				.filter((word) => word.length > 3)
				.slice(0, 3);
			const groupKey = `${amountKey}-${keyWords.join("-")}`;

			if (!groupedExpenses[groupKey]) {
				groupedExpenses[groupKey] = [];
			}
			groupedExpenses[groupKey].push(expense);
		});

		const recurringPatterns = [];

		// Analyze each group for recurring patterns
		Object.keys(groupedExpenses).forEach((key) => {
			const group = groupedExpenses[key];

			// Only consider groups with at least 2 expenses
			if (group.length >= 2) {
				// Sort by date
				group.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

				// Check for patterns in time intervals
				const intervals = [];
				for (let i = 1; i < group.length; i++) {
					const daysDiff = Math.round(
						(new Date(group[i].createdAt) - new Date(group[i - 1].createdAt)) /
							(1000 * 60 * 60 * 24)
					);
					intervals.push(daysDiff);
				}

				// Calculate average interval
				const avgInterval =
					intervals.reduce((sum, val) => sum + val, 0) / intervals.length;

				// Determine frequency based on average interval
				let frequency;
				if (avgInterval <= 8) frequency = "weekly";
				else if (avgInterval <= 18) frequency = "biweekly";
				else if (avgInterval <= 35) frequency = "monthly";
				else if (avgInterval <= 100) frequency = "quarterly";
				else frequency = "yearly";

				// Calculate confidence level based on consistency of intervals
				const stdDev = Math.sqrt(
					intervals.reduce(
						(sum, val) => sum + Math.pow(val - avgInterval, 2),
						0
					) / intervals.length
				);
				const confidence = Math.max(
					0,
					Math.min(100, 100 - (stdDev / avgInterval) * 100)
				);

				// Calculate next due date based on last expense and frequency
				const lastDate = new Date(group[group.length - 1].createdAt);
				const nextDueDate = new Date(lastDate);

				switch (frequency) {
					case "weekly":
						nextDueDate.setDate(lastDate.getDate() + 7);
						break;
					case "biweekly":
						nextDueDate.setDate(lastDate.getDate() + 14);
						break;
					case "monthly":
						nextDueDate.setMonth(lastDate.getMonth() + 1);
						break;
					case "quarterly":
						nextDueDate.setMonth(lastDate.getMonth() + 3);
						break;
					case "yearly":
						nextDueDate.setFullYear(lastDate.getFullYear() + 1);
						break;
				}

				// Use the most recent expense as the template
				const latestExpense = group[group.length - 1];

				recurringPatterns.push({
					description: latestExpense.description,
					amount: latestExpense.amount,
					category: latestExpense.category || "Uncategorized",
					frequency,
					nextDueDate,
					confidence: Math.round(confidence),
					occurrences: group.length,
				});
			}
		});

		// Sort by confidence level (descending)
		return recurringPatterns.sort((a, b) => b.confidence - a.confidence);
	} catch (error) {
		console.error("Error detecting recurring expenses:", error);
		throw error;
	}
};

/**
 * Generate a better name for a bill based on its description
 * @param {string} description - Original expense description
 * @returns {Promise<string>} - Generated bill name
 */
export const generateBillName = async (description) => {
	try {
		// For MVP, we'll use a simple approach to generate a bill name
		// This can be replaced with an API call to Claude AI later

		// Remove common transaction prefixes/suffixes
		let cleanDescription = description
			.replace(
				/payment to|payment for|invoice|bill|receipt|transaction|#\d+/gi,
				""
			)
			.trim();

		// Capitalize first letter of each word
		const billName = cleanDescription
			.split(" ")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(" ");

		return billName || description;

		/* 
    // For future implementation with Claude AI:
    const response = await axios.post(process.env.CLAUDE_API_URL, {
      prompt: `Generate a concise, descriptive name for a recurring bill with this description: "${description}"`,
      max_tokens: 20
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.CLAUDE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.completion.trim();
    */
	} catch (error) {
		console.error("Error generating bill name:", error);
		// Fall back to original description if there's an error
		return description;
	}
};
