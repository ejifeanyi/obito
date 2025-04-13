// src/controllers/payment.controller.js
import {
	createPaymentIntent,
	markShareAsPaid,
	getUserUnpaidShares,
	sendPaymentReminders,
} from "../services/payment.service.js";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Create a payment intent
export const initiatePayment = async (req, res) => {
	try {
		const { expenseId } = req.body;
		const userId = req.user.id;

		if (!expenseId) {
			return res.status(400).json({ error: "Expense ID is required" });
		}

		const paymentIntent = await createPaymentIntent(userId, expenseId);

		res.json({
			message: "Payment initiated successfully",
			paymentIntent,
		});
	} catch (error) {
		console.error("Initiate payment error:", error);
		res.status(500).json({
			error: error.message || "An error occurred while initiating payment",
		});
	}
};

// Handle Stripe webhook events
export const handleStripeWebhook = async (req, res) => {
	const sig = req.headers["stripe-signature"];
	let event;

	try {
		event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
	} catch (err) {
		console.error(`Webhook signature verification failed: ${err.message}`);
		return res.status(400).send(`Webhook Error: ${err.message}`);
	}

	// Handle the event
	switch (event.type) {
		case "payment_intent.succeeded":
			const paymentIntent = event.data.object;
			console.log(`Payment succeeded: ${paymentIntent.id}`);

			try {
				const updatedShare = await markShareAsPaid(paymentIntent.id);

				// Emit real-time notification
				req.io
					.to(`group:${updatedShare.expense.groupId}`)
					.emit("payment-completed", {
						expenseId: updatedShare.expenseId,
						userId: updatedShare.userId,
						userName: `${updatedShare.user.firstName} ${updatedShare.user.lastName}`,
						amount: updatedShare.amount,
					});

				// Also notify the user who made the payment
				req.io.to(`user:${updatedShare.userId}`).emit("payment-successful", {
					expenseId: updatedShare.expenseId,
					amount: updatedShare.amount,
					description: updatedShare.expense.description,
				});
			} catch (error) {
				console.error("Error updating payment status:", error);
			}
			break;

		case "payment_intent.payment_failed":
			const failedPayment = event.data.object;
			console.log(`Payment failed: ${failedPayment.id}`);

			// You could update a payment status or notify users here
			break;

		default:
			console.log(`Unhandled event type: ${event.type}`);
	}

	// Return a 200 response to acknowledge receipt of the event
	res.send({ received: true });
};

// Get all unpaid expense shares for a user
export const getUnpaidShares = async (req, res) => {
	try {
		const userId = req.user.id;
		const unpaidShares = await getUserUnpaidShares(userId);

		res.json({ unpaidShares });
	} catch (error) {
		console.error("Get unpaid shares error:", error);
		res.status(500).json({
			error: error.message || "An error occurred while fetching unpaid shares",
		});
	}
};

// Send payment reminders for a group
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

		const reminders = await sendPaymentReminders(groupId);

		// Emit real-time notifications for reminders
		reminders.forEach((reminder) => {
			const share = reminder.expenseShare;

			// Notify the user who has to pay
			req.io.to(`user:${share.userId}`).emit("payment-reminder", {
				expenseId: share.expenseId,
				description: share.expense.description,
				amount: share.amount,
				groupId: share.expense.groupId,
			});
		});

		res.json({
			message: `${reminders.length} payment reminders sent successfully`,
			reminders,
		});
	} catch (error) {
		console.error("Send payment reminders error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while sending payment reminders" });
	}
};
