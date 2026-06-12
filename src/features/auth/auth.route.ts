import { Router } from 'express';
import {
  register,
  login,
  getProfile,
  googleLogin,
  logoutAllSessions,
  changePassword,
  setupTwoFactor,
  verifyTwoFactor,
  disableTwoFactor,
  linkGoogleAccount,
  unlinkGoogleAccount,
} from './auth.controller';
import {
  updateProfile,
  getUserById,
  getFollowers,
  getFollowing,
  followUser,
  unfollowUser,
  updateNotificationPrefs,
  blockUser,
  unblockUser,
  getBlockedUsers,
} from './social.controller';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';

const router = Router();

router.post('/register', register as any);
router.post('/login', login as any);
router.post('/google', googleLogin as any);

router.get('/profile', authenticateJWT as any, getProfile as any);
router.patch('/profile', authenticateJWT as any, updateProfile as any);
router.get('/users/:userId', authenticateJWT as any, getUserById as any);
router.get('/users/:userId/followers', authenticateJWT as any, getFollowers as any);
router.get('/users/:userId/following', authenticateJWT as any, getFollowing as any);
router.post('/users/:userId/follow', authenticateJWT as any, followUser as any);
router.delete('/users/:userId/follow', authenticateJWT as any, unfollowUser as any);
router.post('/users/:userId/block', authenticateJWT as any, blockUser as any);
router.delete('/users/:userId/block', authenticateJWT as any, unblockUser as any);
router.get('/blocked-users', authenticateJWT as any, getBlockedUsers as any);
router.patch('/notification-prefs', authenticateJWT as any, updateNotificationPrefs as any);
router.post('/logout-all-sessions', authenticateJWT as any, logoutAllSessions as any);
router.post('/change-password', authenticateJWT as any, changePassword as any);
router.post('/2fa/setup', authenticateJWT as any, setupTwoFactor as any);
router.post('/2fa/verify', authenticateJWT as any, verifyTwoFactor as any);
router.post('/2fa/disable', authenticateJWT as any, disableTwoFactor as any);
router.post('/link-google', authenticateJWT as any, linkGoogleAccount as any);
router.post('/unlink-google', authenticateJWT as any, unlinkGoogleAccount as any);

export default router;
