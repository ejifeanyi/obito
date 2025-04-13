// src/services/payment.service.js
import Stripe from "stripe";
import prisma from "../db.js";
import dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a payment intent for a user to pay their share
 * @param {string} userId - User making the payment
 * @param {string} expenseId - Expense being paid
 * @returns {Promise<Object>} - Payment intent details
 */
export const createPaymentIntent = async (userId, expenseId) => {
	try {
		// Get the expense share
		const share = await prisma.expenseShare.findUnique({
			where: {
				userId_expenseId: {
					userId,
					expenseId,
				},
			},
			include: {
				expense: {
					include: {
						paidBy: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								email: true,
							},
						},
						group: true,
					},
				},
				user: {
					select: {
						email: true,
						firstName: true,
						lastName: true,
					},
				},
			},
		});

		if (!share) {
			throw new Error("Expense share not found");
		}

		// Check if share has already been paid
		if (share.paid) {
			throw new Error("This expense share has already been paid");
		}

		// Calculate amount in cents (Stripe uses smallest currency unit)
		const amountInCents = Math.round(share.amount * 100);

		// Create a payment intent
		const paymentIntent = await stripe.paymentIntents.create({
			amount: amountInCents,
			currency: "usd", // You can make this configurable
			metadata: {
				expenseId,
				userId,
				shareId: share.id,
				groupId: share.expense.groupId,
				description: share.expense.description,
			},
			receipt_email: share.user.email,
			description: `Payment for "${share.expense.description}" in group "${share.expense.group.name}"`,
		});

		return {
			clientSecret: paymentIntent.client_secret,
			paymentIntentId: paymentIntent.id,
			amount: share.amount,
			description: share.expense.description,
			group: share.expense.group.name,
			paidTo: share.expense.paidBy,
		};
	} catch (error) {
		console.error("Create payment intent error:", error);
		throw error;
	}
};

/**
 * Update expense share as paid after successful payment
 * @param {string} paymentIntentId - Stripe payment intent ID
 * @returns {Promise<Object>} - Updated expense share
 */
export const markShareAsPaid = async (paymentIntentId) => {
	try {
		// Retrieve the payment intent to get metadata
		const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

		if (!paymentIntent || paymentIntent.status !== "succeeded") {
			throw new Error("Payment not successful");
		}

		const { expenseId, userId, shareId } = paymentIntent.metadata;

		// Update the expense share in the database
		const updatedShare = await prisma.expenseShare.update({
			where: { id: shareId },
			data: {
				paid: true,
				paidAt: new Date(),
				paymentIntentId,
			},
			include: {
				expense: {
					include: {
						group: true,
					},
				},
				user: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
					},
				},
			},
		});

		return updatedShare;
	} catch (error) {
		console.error("Mark share as paid error:", error);
		throw error;
	}
};

/**
 * Get all unpaid shares for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - List of unpaid shares
 */
export const getUserUnpaidShares = async (userId) => {
	try {
		const unpaidShares = await prisma.expenseShare.findMany({
			where: {
				userId,
				paid: false,
			},
			include: {
				expense: {
					include: {
						group: {
							select: {
								id: true,
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
					},
				},
			},
			orderBy: {
				expense: {
					createdAt: "desc",
				},
			},
		});

		return unpaidShares;
	} catch (error) {
		console.error("Get user unpaid shares error:", error);
		throw error;
	}
};

/**
 * Send payment reminders for unpaid expense shares
 * @param {string} groupId - Group ID
 * @returns {Promise<Array>} - Sent reminders
 */
export const sendPaymentReminders = async (groupId) => {
	try {
		// Get all unpaid shares for the group's expenses
		// that are older than 3 days
		const threeDaysAgo = new Date();
		threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

		const unpaidShares = await prisma.expenseShare.findMany({
			where: {
				paid: false,
				expense: {
					groupId,
					createdAt: {
						lt: threeDaysAgo,
					},
				},
			},
			include: {
				expense: true,
				user: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
					},
				},
			},
		});

		const sentReminders = [];

		// For each unpaid share, create a reminder record
		for (const share of unpaidShares) {
			// Check if we already sent a reminder in the last 3 days
			const recentReminder = await prisma.paymentReminder.findFirst({
				where: {
					expenseShareId: share.id,
					createdAt: {
						gt: threeDaysAgo,
					},
				},
			});

			if (!recentReminder) {
				// Create a reminder record
				const reminder = await prisma.paymentReminder.create({
					data: {
						expenseShareId: share.id,
						status: "sent",
					},
					include: {
						expenseShare: {
							include: {
								expense: true,
								user: {
									select: {
										id: true,
										firstName: true,
										lastName: true,
										email: true,
									},
								},
							},
						},
					},
				});

				sentReminders.push(reminder);

				// NOTE: Here you would typically send an actual email notification
				// This is where you'd integrate with your email service
				console.log(
					`Payment reminder sent to ${share.user.email} for expense ${share.expense.description}`
				);
			}
		}

		return sentReminders;
	} catch (error) {
		console.error("Send payment reminders error:", error);
		throw error;
	}
};
