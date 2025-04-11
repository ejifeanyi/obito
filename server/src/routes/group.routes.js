// src/routes/group.routes.js
import express from "express";
import {
	createGroup,
	getUserGroups,
	getGroupById,
	joinGroupByCode,
	inviteToGroup,
	acceptInvitation,
	updateMemberRole,
	removeMember,
	deleteGroup,
	updateGroup,
	refreshGroupCode,
} from "../controllers/group.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import {
	checkGroupMembership,
	checkGroupAdminRole,
} from "../middlewares/group.middleware.js";

const router = express.Router();

router.use(authenticateToken);

// Group management
router.post("/", createGroup);
router.get("/", getUserGroups);
router.get("/:groupId", checkGroupMembership, getGroupById);
router.put("/:groupId", checkGroupAdminRole, updateGroup);
router.delete("/:groupId", checkGroupAdminRole, deleteGroup);

// Invitations and joining
router.post("/join", joinGroupByCode);
router.post("/:groupId/invite", checkGroupAdminRole, inviteToGroup);
router.post("/invite/:token/accept", acceptInvitation);
router.post("/:groupId/refresh-code", checkGroupAdminRole, refreshGroupCode);

// Member management
router.put(
	"/:groupId/members/:memberId/role",
	checkGroupAdminRole,
	updateMemberRole
);
router.delete(
	"/:groupId/members/:memberId",
	checkGroupMembership,
	removeMember
);

export default router;
