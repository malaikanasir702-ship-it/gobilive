"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const activity_logs_controller_1 = require("./activity-logs.controller");
const rbac_middleware_1 = require("../../core/middlewares/rbac.middleware");
const router = (0, express_1.Router)();
router.use(rbac_middleware_1.authenticateAdminPanel);
// Activity logs are company_admin only
const COMPANY_ONLY = (0, rbac_middleware_1.requireRoles)('company_admin');
// /export MUST come before /:id so it is not matched as an id param
router.get('/export', COMPANY_ONLY, activity_logs_controller_1.exportActivityLogs);
router.get('/', COMPANY_ONLY, activity_logs_controller_1.listActivityLogs);
router.get('/:id', COMPANY_ONLY, activity_logs_controller_1.getActivityLog);
exports.default = router;
