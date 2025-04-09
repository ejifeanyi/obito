// src/utils/invite.utils.js
import crypto from "crypto";

export const generateInviteToken = () => {
	return crypto.randomBytes(20).toString("hex");
};

export const generateGroupCode = () => {
	return crypto.randomBytes(4).toString("hex").toUpperCase();
};
