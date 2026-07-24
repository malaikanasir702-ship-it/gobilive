"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_admin_controller_1 = require("./dashboard-admin.controller");
const rbac_middleware_1 = require("../../core/middlewares/rbac.middleware");
const router = (0, express_1.Router)();
router.use(rbac_middleware_1.authenticateAdminPanel);
router.get('/', dashboard_admin_controller_1.getDashboard);
exports.default = router;
