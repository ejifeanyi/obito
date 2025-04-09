// src/controllers/group.controller.js
import { PrismaClient } from "@prisma/client";
import {
	generateInviteToken,
	generateGroupCode,
} from "../utils/invite.utils.js";

const prisma = new PrismaClient();

// Create a new group
export const createGroup = async (req, res) => {
	try {
		const { name, description } = req.body;
		const userId = req.user.id;

		const groupCode = generateGroupCode();

		// Create group with the creator as admin
		const group = await prisma.group.create({
			data: {
				name,
				description,
				code: groupCode,
				members: {
					create: {
						userId,
						role: "admin",
					},
				},
			},
			include: {
				members: true,
			},
		});

		res.status(201).json({
			message: "Group created successfully",
			group: {
				id: group.id,
				name: group.name,
				description: group.description,
				code: group.code,
				createdAt: group.createdAt,
			},
		});
	} catch (error) {
		console.error("Create group error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while creating the group" });
	}
};

// Get all groups the user is a member of
export const getUserGroups = async (req, res) => {
	try {
		const userId = req.user.id;

		const groupMemberships = await prisma.groupMember.findMany({
			where: {
				userId,
			},
			include: {
				group: true,
			},
		});

		const groups = groupMemberships.map((membership) => ({
			id: membership.group.id,
			name: membership.group.name,
			description: membership.group.description,
			code: membership.group.code,
			role: membership.role,
			joinedAt: membership.joinedAt,
		}));

		res.json({ groups });
	} catch (error) {
		console.error("Get user groups error:", error);
		res.status(500).json({ error: "An error occurred while fetching groups" });
	}
};

// Get a specific group by ID with members
export const getGroupById = async (req, res) => {
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

		// Get group with members
		const group = await prisma.group.findUnique({
			where: { id: groupId },
			include: {
				members: {
					include: {
						user: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								email: true,
								profileImage: true,
							},
						},
					},
				},
			},
		});

		if (!group) {
			return res.status(404).json({ error: "Group not found" });
		}

		// Format members data
		const members = group.members.map((member) => ({
			id: member.user.id,
			firstName: member.user.firstName,
			lastName: member.user.lastName,
			email: member.user.email,
			profileImage: member.user.profileImage,
			role: member.role,
			joinedAt: member.joinedAt,
		}));

		res.json({
			group: {
				id: group.id,
				name: group.name,
				description: group.description,
				code: group.code,
				createdAt: group.createdAt,
				updatedAt: group.updatedAt,
				members,
			},
		});
	} catch (error) {
		console.error("Get group error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while fetching the group" });
	}
};

// Join a group using invite code
export const joinGroupByCode = async (req, res) => {
	try {
		const { code } = req.body;
		const userId = req.user.id;

		// Find group by code
		const group = await prisma.group.findUnique({
			where: { code },
		});

		if (!group) {
			return res.status(404).json({ error: "Invalid group code" });
		}

		// Check if user is already a member
		const existingMembership = await prisma.groupMember.findUnique({
			where: {
				userId_groupId: {
					userId,
					groupId: group.id,
				},
			},
		});

		if (existingMembership) {
			return res
				.status(409)
				.json({ error: "You are already a member of this group" });
		}

		// Add user as member
		await prisma.groupMember.create({
			data: {
				userId,
				groupId: group.id,
				role: "member",
			},
		});

		res.json({
			message: "Successfully joined the group",
			group: {
				id: group.id,
				name: group.name,
				description: group.description,
			},
		});
	} catch (error) {
		console.error("Join group error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while joining the group" });
	}
};

// Send an email invitation to join a group
export const inviteToGroup = async (req, res) => {
	try {
		const { groupId } = req.params;
		const { email } = req.body;
		const userId = req.user.id;

		// Check if user is an admin of the group
		const membership = await prisma.groupMember.findUnique({
			where: {
				userId_groupId: {
					userId,
					groupId,
				},
			},
		});

		if (!membership || membership.role !== "admin") {
			return res
				.status(403)
				.json({ error: "Only group admins can send invitations" });
		}

		// Check if the email is already a member
		const existingUser = await prisma.user.findUnique({
			where: { email },
			include: {
				groupMemberships: {
					where: { groupId },
				},
			},
		});

		if (existingUser && existingUser.groupMemberships.length > 0) {
			return res
				.status(409)
				.json({ error: "This user is already a member of the group" });
		}

		// Check if there's already a pending invitation
		const existingInvite = await prisma.groupInvite.findFirst({
			where: {
				email,
				groupId,
				expiresAt: {
					gt: new Date(),
				},
			},
		});

		if (existingInvite) {
			return res
				.status(409)
				.json({ error: "An invitation has already been sent to this email" });
		}

		// Generate invitation token
		const token = generateInviteToken();
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

		// Create invite
		const invite = await prisma.groupInvite.create({
			data: {
				email,
				token,
				expiresAt,
				groupId,
				inviterId: userId,
			},
			include: {
				group: true,
			},
		});

		// Here you would normally send an email with the invite link
		// This would require an email service integration
		// For now, we'll just return the token for testing purposes

		res.status(201).json({
			message: "Invitation sent successfully",
			invite: {
				email,
				token,
				expiresAt,
				groupName: invite.group.name,
			},
		});
	} catch (error) {
		console.error("Invite to group error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while sending the invitation" });
	}
};

// Accept a group invitation
export const acceptInvitation = async (req, res) => {
	try {
		const { token } = req.params;
		const userId = req.user.id;

		// Find and validate invitation
		const invite = await prisma.groupInvite.findUnique({
			where: { token },
			include: { group: true },
		});

		if (!invite) {
			return res.status(404).json({ error: "Invalid invitation token" });
		}

		if (new Date() > invite.expiresAt) {
			await prisma.groupInvite.delete({ where: { id: invite.id } });
			return res.status(410).json({ error: "This invitation has expired" });
		}

		// Verify user email matches invited email
		if (req.user.email.toLowerCase() !== invite.email.toLowerCase()) {
			return res
				.status(403)
				.json({
					error: "This invitation was sent to a different email address",
				});
		}

		// Check if user is already a member
		const existingMembership = await prisma.groupMember.findUnique({
			where: {
				userId_groupId: {
					userId,
					groupId: invite.groupId,
				},
			},
		});

		if (existingMembership) {
			await prisma.groupInvite.delete({ where: { id: invite.id } });
			return res
				.status(409)
				.json({ error: "You are already a member of this group" });
		}

		// Add user as member and delete invitation
		await prisma.$transaction([
			prisma.groupMember.create({
				data: {
					userId,
					groupId: invite.groupId,
					role: "member",
				},
			}),
			prisma.groupInvite.delete({ where: { id: invite.id } }),
		]);

		res.json({
			message: "Successfully joined the group",
			group: {
				id: invite.group.id,
				name: invite.group.name,
				description: invite.group.description,
			},
		});
	} catch (error) {
		console.error("Accept invitation error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while accepting the invitation" });
	}
};

// Update member role (promote to admin or demote to member)
export const updateMemberRole = async (req, res) => {
	try {
		const { groupId, memberId } = req.params;
		const { role } = req.body;
		const userId = req.user.id;

		if (role !== "admin" && role !== "member") {
			return res
				.status(400)
				.json({ error: 'Invalid role. Must be "admin" or "member"' });
		}

		// Check if requester is an admin
		const requesterMembership = await prisma.groupMember.findUnique({
			where: {
				userId_groupId: {
					userId,
					groupId,
				},
			},
		});

		if (!requesterMembership || requesterMembership.role !== "admin") {
			return res
				.status(403)
				.json({ error: "Only group admins can update member roles" });
		}

		// Find the target member
		const targetMembership = await prisma.groupMember.findFirst({
			where: {
				groupId,
				user: {
					id: memberId,
				},
			},
			include: {
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

		if (!targetMembership) {
			return res.status(404).json({ error: "Member not found in this group" });
		}

		// Update role
		const updatedMembership = await prisma.groupMember.update({
			where: {
				id: targetMembership.id,
			},
			data: {
				role,
			},
			include: {
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

		res.json({
			message: `Member role updated to ${role}`,
			member: {
				id: updatedMembership.user.id,
				firstName: updatedMembership.user.firstName,
				lastName: updatedMembership.user.lastName,
				email: updatedMembership.user.email,
				role: updatedMembership.role,
			},
		});
	} catch (error) {
		console.error("Update member role error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while updating the member role" });
	}
};

// Remove a member from a group
export const removeMember = async (req, res) => {
	try {
		const { groupId, memberId } = req.params;
		const userId = req.user.id;

		// Check if requester is an admin or the member themselves
		const requesterMembership = await prisma.groupMember.findUnique({
			where: {
				userId_groupId: {
					userId,
					groupId,
				},
			},
		});

		const isSelfRemoval = userId === memberId;

		if (
			!requesterMembership ||
			(!isSelfRemoval && requesterMembership.role !== "admin")
		) {
			return res.status(403).json({
				error:
					"You must be an admin to remove other members or can only remove yourself",
			});
		}

		// Check if there would be at least one admin left after removal
		if (requesterMembership.role === "admin" && isSelfRemoval) {
			const adminCount = await prisma.groupMember.count({
				where: {
					groupId,
					role: "admin",
				},
			});

			if (adminCount <= 1) {
				return res.status(400).json({
					error:
						"Cannot remove the last admin. Promote another member to admin first.",
				});
			}
		}

		// Find the target member
		const targetMembership = await prisma.groupMember.findFirst({
			where: {
				groupId,
				userId: memberId,
			},
		});

		if (!targetMembership) {
			return res.status(404).json({ error: "Member not found in this group" });
		}

		// Remove member
		await prisma.groupMember.delete({
			where: {
				id: targetMembership.id,
			},
		});

		const message = isSelfRemoval
			? "You have left the group"
			: "Member removed successfully";

		res.json({ message });
	} catch (error) {
		console.error("Remove member error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while removing the member" });
	}
};

// Delete a group (admin only)
export const deleteGroup = async (req, res) => {
	try {
		const { groupId } = req.params;
		const userId = req.user.id;

		// Check if requester is an admin
		const membership = await prisma.groupMember.findUnique({
			where: {
				userId_groupId: {
					userId,
					groupId,
				},
			},
		});

		if (!membership || membership.role !== "admin") {
			return res
				.status(403)
				.json({ error: "Only group admins can delete a group" });
		}

		// Delete group (will cascade delete members and invites)
		await prisma.group.delete({
			where: { id: groupId },
		});

		res.json({ message: "Group deleted successfully" });
	} catch (error) {
		console.error("Delete group error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while deleting the group" });
	}
};

// Update group details
export const updateGroup = async (req, res) => {
	try {
		const { groupId } = req.params;
		const { name, description } = req.body;
		const userId = req.user.id;

		// Check if requester is an admin
		const membership = await prisma.groupMember.findUnique({
			where: {
				userId_groupId: {
					userId,
					groupId,
				},
			},
		});

		if (!membership || membership.role !== "admin") {
			return res
				.status(403)
				.json({ error: "Only group admins can update group details" });
		}

		// Update group
		const updatedGroup = await prisma.group.update({
			where: { id: groupId },
			data: {
				name,
				description,
			},
		});

		res.json({
			message: "Group updated successfully",
			group: {
				id: updatedGroup.id,
				name: updatedGroup.name,
				description: updatedGroup.description,
				code: updatedGroup.code,
				updatedAt: updatedGroup.updatedAt,
			},
		});
	} catch (error) {
		console.error("Update group error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while updating the group" });
	}
};

// Generate a new invite code
export const refreshGroupCode = async (req, res) => {
	try {
		const { groupId } = req.params;
		const userId = req.user.id;

		// Check if requester is an admin
		const membership = await prisma.groupMember.findUnique({
			where: {
				userId_groupId: {
					userId,
					groupId,
				},
			},
		});

		if (!membership || membership.role !== "admin") {
			return res
				.status(403)
				.json({ error: "Only group admins can refresh the invite code" });
		}

		// Generate new code
		const newCode = generateGroupCode();

		// Update group
		const updatedGroup = await prisma.group.update({
			where: { id: groupId },
			data: {
				code: newCode,
			},
		});

		res.json({
			message: "Group invite code refreshed",
			code: updatedGroup.code,
		});
	} catch (error) {
		console.error("Refresh group code error:", error);
		res
			.status(500)
			.json({ error: "An error occurred while refreshing the group code" });
	}
};
