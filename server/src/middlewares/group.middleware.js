// src/middlewares/group.middleware.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const checkGroupMembership = async (req, res, next) => {
	try {
		const { groupId } = req.params;
		const userId = req.user.id;

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

		req.groupMembership = membership;
		next();
	} catch (error) {
		console.error("Check group membership error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while checking group membership" });
	}
};

export const checkGroupAdminRole = async (req, res, next) => {
	try {
		const { groupId } = req.params;
		const userId = req.user.id;

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

		if (membership.role !== "admin") {
			return res
				.status(403)
				.json({ error: "This action requires admin privileges" });
		}

		req.groupMembership = membership;
		next();
	} catch (error) {
		console.error("Check admin role error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while checking admin privileges" });
	}
};
