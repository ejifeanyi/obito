// src/routes/dashboard.routes.js
import express from "express";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import {
	getUserDashboard,
	getGroupDashboard,
} from "../controllers/dashboard.controller.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/", getUserDashboard);
router.get("/group/:groupId", getGroupDashboard);

export default router;
