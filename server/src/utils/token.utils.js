// src/utils/token.utils.js
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const generateTokens = async (userId) => {
	// Access token - short lived (15 minutes)
	const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
		expiresIn: "15m",
	});

	// Refresh token - longer lived (15 days)
	const refreshToken = crypto.randomBytes(40).toString("hex");
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 15); // 15 days from now

	// Store refresh token in database
	await prisma.refreshToken.create({
		data: {
			token: refreshToken,
			userId,
			expiresAt,
		},
	});

	return { accessToken, refreshToken };
};

export const verifyRefreshToken = async (token) => {
	const refreshTokenRecord = await prisma.refreshToken.findUnique({
		where: { token },
		include: { user: true },
	});

	if (!refreshTokenRecord) {
		throw new Error("Invalid refresh token");
	}

	if (new Date() > refreshTokenRecord.expiresAt) {
		// Remove expired token
		await prisma.refreshToken.delete({ where: { id: refreshTokenRecord.id } });
		throw new Error("Refresh token expired");
	}

	return refreshTokenRecord.user;
};

export const invalidateRefreshToken = async (token) => {
	await prisma.refreshToken.delete({ where: { token } });
};
