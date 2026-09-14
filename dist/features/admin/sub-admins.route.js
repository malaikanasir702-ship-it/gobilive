"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sub_admins_controller_1 = require("./sub-admins.controller");
const rbac_middleware_1 = require("../../core/middlewares/rbac.middleware");
const router = (0, express_1.Router)();
router.use(rbac_middleware_1.authenticateAdminPanel);
const GUARD = (0, rbac_middleware_1.requireRoles)('company_admin', 'super_admin');
const SUB_ADMIN = (0, rbac_middleware_1.requireRoles)('sub_admin');
const SA_OR_ABOVE = (0, rbac_middleware_1.requireRoles)('company_admin', 'super_admin', 'sub_admin');
// ── Sub Admin's own agency management ────────────────────────────────────────
// sub_admin can list & create their own agencies
// super_admin/company_admin can also POST with { subAdminId } in body
router.get('/my-agencies', SUB_ADMIN, sub_admins_controller_1.listMyAgenciesForSubAdmin);
router.post('/my-agencies', SA_OR_ABOVE, sub_admins_controller_1.createAgencyBySubAdmin);
// ── Sub Admin management (super/company admin only) ───────────────────────────
router.get('/', GUARD, sub_admins_controller_1.listSubAdmins);
router.get('/:id', GUARD, sub_admins_controller_1.getSubAdminDetail);
router.post('/:id/approve', GUARD, sub_admins_controller_1.approveSubAdmin);
router.post('/:id/reject', GUARD, sub_admins_controller_1.rejectSubAdmin);
router.post('/:id/block', GUARD, sub_admins_controller_1.blockSubAdmin);
router.post('/:id/unblock', GUARD, sub_admins_controller_1.unblockSubAdmin);
exports.default = router;
