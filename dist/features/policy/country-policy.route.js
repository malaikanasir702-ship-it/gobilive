"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const country_policy_controller_1 = require("./country-policy.controller");
const rbac_middleware_1 = require("../../core/middlewares/rbac.middleware");
const router = (0, express_1.Router)();
// Public / User routes
router.get('/countries', country_policy_controller_1.getAllCountryPolicies);
router.get('/country', country_policy_controller_1.getCountryPolicy);
router.get('/financial-analysis', country_policy_controller_1.getFinancialAnalysis);
// Admin route
router.put('/countries', rbac_middleware_1.authenticateAdminPanel, country_policy_controller_1.upsertCountryPolicy);
router.post('/countries', rbac_middleware_1.authenticateAdminPanel, country_policy_controller_1.upsertCountryPolicy);
exports.default = router;
