"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_auth_controller_1 = require("../admin/admin-auth.controller");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.post('/login', admin_auth_controller_1.adminLogin);
router.post('/logout', auth_middleware_1.authenticateJWT, admin_auth_controller_1.adminLogout);
exports.default = router;
