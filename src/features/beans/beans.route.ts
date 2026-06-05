import { Router } from 'express';
import {
  getBeanWallet,
  generateBeans,
  assignBeans,
  getBeanDollarRate,
  updateBeanDollarRate,
  getD2BCommission,
  updateD2BCommission,
  getD2BRate,
  updateD2BRate,
  getDollarConversionRates,
  updateDollarConversionRate,
  getBeanLogs,
} from './beans.controller';
import { authenticateAdminPanel, requireRoles } from '../../core/middlewares/rbac.middleware';

const router = Router();

// All beans routes require admin-panel authentication and company_admin role.
router.use(authenticateAdminPanel as any);

router.get('/wallet', requireRoles('company_admin') as any, getBeanWallet as any);
router.post('/generate', requireRoles('company_admin') as any, generateBeans as any);
router.post('/assign', requireRoles('company_admin') as any, assignBeans as any);

router.get('/bean-dollar-rate', requireRoles('company_admin') as any, getBeanDollarRate as any);
router.post('/bean-dollar-rate', requireRoles('company_admin') as any, updateBeanDollarRate as any);

router.get('/d2b/commission', requireRoles('company_admin') as any, getD2BCommission as any);
router.post('/d2b/commission', requireRoles('company_admin') as any, updateD2BCommission as any);

router.get('/d2b/rate', requireRoles('company_admin') as any, getD2BRate as any);
router.post('/d2b/rate', requireRoles('company_admin') as any, updateD2BRate as any);

router.get('/dollar-conversion', requireRoles('company_admin') as any, getDollarConversionRates as any);
router.post('/dollar-conversion', requireRoles('company_admin') as any, updateDollarConversionRate as any);

router.get('/logs', requireRoles('company_admin') as any, getBeanLogs as any);

export default router;
