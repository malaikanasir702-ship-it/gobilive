import { Router } from 'express';
import {
  getAllCountryPolicies,
  getCountryPolicy,
  upsertCountryPolicy,
} from './country-policy.controller';
import { authenticateAdminPanel } from '../../core/middlewares/rbac.middleware';

const router = Router();

// Public / User routes
router.get('/countries', getAllCountryPolicies);
router.get('/country', getCountryPolicy);

// Admin route
router.put('/countries', authenticateAdminPanel, upsertCountryPolicy);
router.post('/countries', authenticateAdminPanel, upsertCountryPolicy);

export default router;
