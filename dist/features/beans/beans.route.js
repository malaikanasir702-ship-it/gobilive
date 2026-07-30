"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const beans_controller_1 = require("./beans.controller");
const rbac_middleware_1 = require("../../core/middlewares/rbac.middleware");
const router = (0, express_1.Router)();
// Public — no auth needed
router.get('/public/agents', beans_controller_1.getPublicAgents);
// All beans routes require admin-panel authentication and company_admin role.
router.use(rbac_middleware_1.authenticateAdminPanel);
router.get('/wallet', (0, rbac_middleware_1.requireRoles)('company_admin', 'top_up_agent', 'reseller'), beans_controller_1.getBeanWallet);
router.post('/generate', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.generateBeans);
router.post('/assign', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.assignBeans);
// Frontend calls /beans/dollar-rate  (flat, no "bean-" prefix)
router.get('/dollar-rate', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.getBeanDollarRate);
router.post('/dollar-rate', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.updateBeanDollarRate);
// Keep old path for backward-compat
router.get('/bean-dollar-rate', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.getBeanDollarRate);
router.post('/bean-dollar-rate', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.updateBeanDollarRate);
// Frontend calls /beans/d2b-commission  (flat, no nested "/d2b/")
router.get('/d2b-commission', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.getD2BCommission);
router.post('/d2b-commission', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.updateD2BCommission);
// Keep old nested path
router.get('/d2b/commission', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.getD2BCommission);
router.post('/d2b/commission', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.updateD2BCommission);
// Frontend calls /beans/d2b-rate  (flat)
router.get('/d2b-rate', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.getD2BRate);
router.post('/d2b-rate', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.updateD2BRate);
// Keep old nested path
router.get('/d2b/rate', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.getD2BRate);
router.post('/d2b/rate', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.updateD2BRate);
router.get('/dollar-conversion', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.getDollarConversionRates);
router.post('/dollar-conversion', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.updateDollarConversionRate);
router.get('/logs', (0, rbac_middleware_1.requireRoles)('company_admin'), beans_controller_1.getBeanLogs);
exports.default = router;
