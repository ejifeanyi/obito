// src/utils/ai.utils.js
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Categories for expenses
const EXPENSE_CATEGORIES = [
	"Food & Dining",
	"Groceries",
	"Transportation",
	"Entertainment",
	"Shopping",
	"Utilities",
	"Rent",
	"Travel",
	"Healthcare",
	"Education",
	"Personal Care",
	"Gifts & Donations",
	"Business",
	"Home Improvement",
	"Insurance",
	"Taxes",
	"Fees & Charges",
	"Other",
];

/**
 * Use Claude to categorize an expense based on its description
 * @param {string} description - The expense description
 * @returns {Promise<string>} - The categorized expense category
 */
export const categorizeExpense = async (description) => {
	try {
		if (!description || description.trim() === "") {
			return "Other";
		}

		// If Claude API key isn't set, use simple keyword matching
		if (!process.env.ANTHROPIC_API_KEY) {
			return categorizeBySingleWordMatch(description);
		}

		const API_URL = "https://api.anthropic.com/v1/messages";
		const response = await axios.post(
			API_URL,
			{
				model: "claude-3-haiku-20240307",
				max_tokens: 50,
				messages: [
					{
						role: "user",
						content: `Categorize this expense into exactly one of these categories: ${EXPENSE_CATEGORIES.join(
							", "
						)}
            
            Expense description: "${description}"
            
            Reply with just the category name and nothing else.`,
					},
				],
			},
			{
				headers: {
					"Content-Type": "application/json",
					"x-api-key": process.env.ANTHROPIC_API_KEY,
					"anthropic-version": "2023-06-01",
				},
			}
		);

		let category = response.data.content[0].text.trim();

		// Ensure the returned category is in our list
		if (!EXPENSE_CATEGORIES.includes(category)) {
			const closestMatch = findClosestCategory(category);
			return closestMatch || "Other";
		}

		return category;
	} catch (error) {
		console.error("AI categorization error:", error.message);
		// Fallback to keyword matching
		return categorizeBySingleWordMatch(description);
	}
};

/**
 * Simple fallback categorization based on keywords
 * @param {string} description
 * @returns {string}
 */
function categorizeBySingleWordMatch(description) {
	const lowerDescription = description.toLowerCase();

	const categoryMapping = {
		// Food & Dining
		restaurant: "Food & Dining",
		cafe: "Food & Dining",
		coffee: "Food & Dining",
		dinner: "Food & Dining",
		lunch: "Food & Dining",
		breakfast: "Food & Dining",
		pizza: "Food & Dining",
		takeout: "Food & Dining",

		// Groceries
		grocery: "Groceries",
		supermarket: "Groceries",
		food: "Groceries",

		// Transportation
		uber: "Transportation",
		lyft: "Transportation",
		taxi: "Transportation",
		gas: "Transportation",
		fuel: "Transportation",
		bus: "Transportation",
		train: "Transportation",
		parking: "Transportation",
		transit: "Transportation",

		// Entertainment
		movie: "Entertainment",
		game: "Entertainment",
		concert: "Entertainment",
		netflix: "Entertainment",
		spotify: "Entertainment",
		theater: "Entertainment",
		event: "Entertainment",
		ticket: "Entertainment",

		// Shopping
		shopping: "Shopping",
		clothes: "Shopping",
		clothing: "Shopping",
		mall: "Shopping",
		amazon: "Shopping",
		store: "Shopping",
		shop: "Shopping",
		purchase: "Shopping",

		// Utilities
		electricity: "Utilities",
		water: "Utilities",
		internet: "Utilities",
		phone: "Utilities",
		wifi: "Utilities",
		cable: "Utilities",
		utility: "Utilities",
		electric: "Utilities",

		// Rent
		rent: "Rent",
		mortgage: "Rent",

		// Travel
		hotel: "Travel",
		flight: "Travel",
		airbnb: "Travel",
		vacation: "Travel",
		trip: "Travel",
		booking: "Travel",

		// Healthcare
		doctor: "Healthcare",
		medicine: "Healthcare",
		hospital: "Healthcare",
		pharmacy: "Healthcare",
		medical: "Healthcare",
		healthcare: "Healthcare",
		fitness: "Healthcare",
		gym: "Healthcare",

		// Education
		course: "Education",
		tuition: "Education",
		books: "Education",
		school: "Education",

		// Personal Care
		haircut: "Personal Care",
		salon: "Personal Care",
		spa: "Personal Care",

		// Gifts & Donations
		charity: "Gifts & Donations",
		gift: "Gifts & Donations",
		present: "Gifts & Donations",
		donation: "Gifts & Donations",

		// Business
		business: "Business",
		office: "Business",

		// Home Improvement
		repair: "Home Improvement",
		furniture: "Home Improvement",
		renovation: "Home Improvement",
		maintenance: "Home Improvement",

		// Insurance
		insurance: "Insurance",

		// Taxes
		tax: "Taxes",

		// Fees & Charges
		fee: "Fees & Charges",
		penalty: "Fees & Charges",
		fine: "Fees & Charges",
		subscription: "Fees & Charges",
		payment: "Fees & Charges",
		bill: "Fees & Charges",
	};

	for (const [keyword, category] of Object.entries(categoryMapping)) {
		if (lowerDescription.includes(keyword)) {
			return category;
		}
	}

	return "Other";
}

/**
 * Find the closest matching category from our list
 * @param {string} category
 * @returns {string}
 */
function findClosestCategory(category) {
	const lowerCategory = category.toLowerCase();

	// Try to find an exact substring match first
	for (const validCategory of EXPENSE_CATEGORIES) {
		if (
			lowerCategory.includes(validCategory.toLowerCase()) ||
			validCategory.toLowerCase().includes(lowerCategory)
		) {
			return validCategory;
		}
	}

	// Otherwise return null and let the caller handle it
	return null;
}
