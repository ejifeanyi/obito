// src/controllers/auth.controller.js
import bcrypt from "bcryptjs";
import {
	generateTokens,
	verifyRefreshToken,
	invalidateRefreshToken,
} from "../utils/token.utils.js";
import axios from "axios";
import prisma from "../db.js";

export const signup = async (req, res) => {
	try {
		const { email, password, firstName, lastName } = req.body;

		// Check if user already exists
		const existingUser = await prisma.user.findUnique({ where: { email } });
		if (existingUser) {
			return res.status(409).json({ error: "Email already in use" });
		}

		// Hash password
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);

		// Create user
		const user = await prisma.user.create({
			data: {
				email,
				password: hashedPassword,
				firstName,
				lastName,
			},
		});

		// Generate tokens
		const { accessToken, refreshToken } = await generateTokens(user.id);

		res.status(201).json({
			message: "User created successfully",
			user: {
				id: user.id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
			},
			tokens: {
				accessToken,
				refreshToken,
			},
		});
	} catch (error) {
		console.error("Signup error:", error);
		res.status(500).json({ error: "An error occurred during registration" });
	}
};

export const login = async (req, res) => {
	try {
		const { email, password } = req.body;

		// Find user
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user || user.provider !== "email") {
			return res.status(401).json({ error: "Invalid credentials" });
		}

		// Verify password
		const validPassword = await bcrypt.compare(password, user.password);
		if (!validPassword) {
			return res.status(401).json({ error: "Invalid credentials" });
		}

		// Generate tokens
		const { accessToken, refreshToken } = await generateTokens(user.id);

		res.json({
			user: {
				id: user.id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
				profileImage: user.profileImage,
			},
			tokens: {
				accessToken,
				refreshToken,
			},
		});
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).json({ error: "An error occurred during login" });
	}
};

export const refreshToken = async (req, res) => {
	try {
		const { refreshToken } = req.body;

		if (!refreshToken) {
			return res.status(400).json({ error: "Refresh token is required" });
		}

		// Verify refresh token
		const user = await verifyRefreshToken(refreshToken);

		// Invalidate old refresh token
		await invalidateRefreshToken(refreshToken);

		// Generate new tokens
		const tokens = await generateTokens(user.id);

		res.json({
			user: {
				id: user.id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
				profileImage: user.profileImage,
			},
			tokens,
		});
	} catch (error) {
		console.error("Refresh token error:", error);
		if (
			error.message === "Invalid refresh token" ||
			error.message === "Refresh token expired"
		) {
			return res.status(401).json({ error: error.message });
		}
		res.status(500).json({ error: "An error occurred during token refresh" });
	}
};

export const logout = async (req, res) => {
	try {
		const { refreshToken } = req.body;

		if (refreshToken) {
			await invalidateRefreshToken(refreshToken);
		}

		res.json({ message: "Logged out successfully" });
	} catch (error) {
		console.error("Logout error:", error);
		res.status(500).json({ error: "An error occurred during logout" });
	}
};

export const googleAuth = async (req, res) => {
	try {
		const { token } = req.body;

		// Verify Google token
		const response = await axios.get(
			"https://www.googleapis.com/oauth2/v3/userinfo",
			{
				headers: { Authorization: `Bearer ${token}` },
			}
		);

		const { sub, email, given_name, family_name, picture } = response.data;

		// Find or create user
		let user = await prisma.user.findUnique({ where: { email } });

		if (!user) {
			// Create new user with Google credentials
			user = await prisma.user.create({
				data: {
					email,
					firstName: given_name,
					lastName: family_name,
					profileImage: picture,
					provider: "google",
					providerId: sub,
				},
			});
		} else if (user.provider !== "google") {
			// Update existing email user to link Google account
			user = await prisma.user.update({
				where: { id: user.id },
				data: {
					provider: "google",
					providerId: sub,
					firstName: user.firstName || given_name,
					lastName: user.lastName || family_name,
					profileImage: user.profileImage || picture,
				},
			});
		}

		// Generate tokens
		const { accessToken, refreshToken } = await generateTokens(user.id);

		res.json({
			user: {
				id: user.id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
				profileImage: user.profileImage,
			},
			tokens: {
				accessToken,
				refreshToken,
			},
		});
	} catch (error) {
		console.error("Google auth error:", error);
		res
			.status(500)
			.json({ error: "An error occurred during Google authentication" });
	}
};

export const getMe = async (req, res) => {
	try {
		// User is already available from the auth middleware
		res.json({ user: req.user });
	} catch (error) {
		console.error("Get me error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while fetching user data" });
	}
};
