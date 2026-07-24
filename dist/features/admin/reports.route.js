"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reports_controller_1 = require("./reports.controller");
const rbac_middleware_1 = require("../../core/middlewares/rbac.middleware");
const router = (0, express_1.Router)();
router.use(rbac_middleware_1.authenticateAdminPanel);
// Agency has view-only access; all others have full access
const VIEW_GUARD = (0, rbac_middleware_1.requireRoles)('company_admin', 'super_admin', 'sub_admin', 'agency', 'sub_agency');
const ACTION_GUARD = (0, rbac_middleware_1.requireRoles)('company_admin', 'super_admin', 'sub_admin');
router.get('/', VIEW_GUARD, reports_controller_1.listReports);
router.get('/:id', VIEW_GUARD, reports_controller_1.getReport);
router.post('/:id/dismiss', ACTION_GUARD, reports_controller_1.dismissReport);
router.post('/:id/escalate', ACTION_GUARD, reports_controller_1.escalateReport);
exports.default = router;
