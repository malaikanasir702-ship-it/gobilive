"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const revenue_controller_1 = require("./revenue.controller");
const rbac_middleware_1 = require("../../core/middlewares/rbac.middleware");
const router = (0, express_1.Router)();
// GET /api/admin-panel/v1/revenue
router.get('/', rbac_middleware_1.authenticateAdminPanel, revenue_controller_1.getRevenueAnalytics);
exports.default = router;
