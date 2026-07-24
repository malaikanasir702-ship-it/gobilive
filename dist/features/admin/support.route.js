"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const support_controller_1 = require("./support.controller");
const rbac_middleware_1 = require("../../core/middlewares/rbac.middleware");
const router = (0, express_1.Router)();
router.use(rbac_middleware_1.authenticateAdminPanel);
// All admin roles with portal access can view support chats
const VIEW_GUARD = (0, rbac_middleware_1.requireRoles)('company_admin', 'super_admin', 'sub_admin', 'agency', 'sub_agency');
// Only agency roles can reply; company/super admin have view-only access (enforced in controller)
const REPLY_GUARD = (0, rbac_middleware_1.requireRoles)('company_admin', 'super_admin', 'sub_admin', 'agency', 'sub_agency');
router.get('/', VIEW_GUARD, support_controller_1.listSupportChats);
router.get('/:id', VIEW_GUARD, support_controller_1.getSupportChat);
router.post('/:id/reply', REPLY_GUARD, support_controller_1.replyToSupportChat);
router.post('/:id/close', VIEW_GUARD, support_controller_1.closeSupportChat);
exports.default = router;
