import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';
import { getTemplates, getTemplateById, createTemplate, useTemplate } from './template.controller';

const router = Router();

router.get('/', authenticateJWT as any, getTemplates as any);
router.get('/:id', authenticateJWT as any, getTemplateById as any);
router.post('/', authenticateJWT as any, createTemplate as any);
router.post('/:id/use', authenticateJWT as any, useTemplate as any);

export default router;
