// src/validation/expense.validation.js
import Joi from "joi";

export const createExpenseSchema = Joi.object({
	groupId: Joi.string().required(),
	amount: Joi.number().positive().required(),
	description: Joi.string().required(),
	category: Joi.string().allow("", null),
	paidById: Joi.string().allow(null),
	splitType: Joi.string().valid("equal", "custom").required(),
	splitDetails: Joi.when("splitType", {
		is: "custom",
		then: Joi.array()
			.items(
				Joi.object({
					userId: Joi.string().required(),
					amount: Joi.number().positive().required(),
				})
			)
			.required(),
		otherwise: Joi.array()
			.items(
				Joi.object({
					userId: Joi.string().required(),
					amount: Joi.number().positive().required(),
				})
			)
			.optional(),
	}),
});

export const updateExpenseSchema = Joi.object({
	amount: Joi.number().positive(),
	description: Joi.string(),
	category: Joi.string().allow("", null),
	paidById: Joi.string().allow(null),
	splitType: Joi.string().valid("equal", "custom"),
	splitDetails: Joi.when("splitType", {
		is: "custom",
		then: Joi.array()
			.items(
				Joi.object({
					userId: Joi.string().required(),
					amount: Joi.number().positive().required(),
				})
			)
			.required(),
		otherwise: Joi.array()
			.items(
				Joi.object({
					userId: Joi.string().required(),
					amount: Joi.number().positive().required(),
				})
			)
			.optional(),
	}),
}).min(1); // At least one field must be provided
