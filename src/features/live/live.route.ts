/**
 * live.route.ts
 *
 * All existing routes are preserved untouched.
 * New /seats, /side-callers, /vips, and /seat-token routes are appended
 * below the existing routes so there is zero risk of breaking changes.
 */

import { Router } from 'express';
import { authenticateJWT } from '../../core/middlewares/auth.middleware';

// ── Existing controller (untouched) ──
import {
  createRoom,
  endRoom,
  getActiveRooms,
  getAgoraCredentials,
  kickViewer,
  getSessionSummary,
  findPkOpponent,
  getMySessions,
  likeRoom,
  saveRoom,
  hideCreator,
  reportRoom,
  updateThumbnail,
} from './live.controller';

// ── NEW: Seat management controller ──
import {
  initSeats,
  requestSeat,
  acceptSeat,
  rejectSeat,
  leaveSeat,
  muteSeat,
  setCamPermission,
  getSeats,
  getSeatToken,
  requestSideCaller,
  acceptSideCaller,
  removeSideCaller,
  setVips,
} from './seat.controller';

const router = Router();

// ─────────────────────────────────────────────
// EXISTING ROUTES (untouched)
// ─────────────────────────────────────────────
router.get('/rooms', authenticateJWT as any, getActiveRooms as any);
router.get('/my-sessions', authenticateJWT as any, getMySessions as any);
router.post('/rooms', authenticateJWT as any, createRoom as any);
router.get('/rooms/:channelName/agora', authenticateJWT as any, getAgoraCredentials as any);
router.post('/rooms/:channelName/end', authenticateJWT as any, endRoom as any);
router.post('/rooms/:channelName/pk/match', authenticateJWT as any, findPkOpponent as any);
router.post('/rooms/:channelName/kick', authenticateJWT as any, kickViewer as any);
router.get('/rooms/:channelName/summary', getSessionSummary as any);

// Like, save, hide, report
router.post('/rooms/:channelName/like', authenticateJWT as any, likeRoom as any);
router.post('/rooms/:channelName/save', authenticateJWT as any, saveRoom as any);
router.post('/creators/hide', authenticateJWT as any, hideCreator as any);
router.post('/rooms/:channelName/report', authenticateJWT as any, reportRoom as any);

// Host: upload a stream snapshot URL for discovery card preview
router.patch('/rooms/:channelName/thumbnail', authenticateJWT as any, updateThumbnail as any);

// ─────────────────────────────────────────────
// NEW: Multi-broadcast seat management
// ─────────────────────────────────────────────

/** Get current seat/side-caller/VIP state (public – viewer can read). */
router.get('/rooms/:channelName/seats', authenticateJWT as any, getSeats as any);

/** Host: initialise seat layout when starting a multi-broadcast room. */
router.post('/rooms/:channelName/seats/init', authenticateJWT as any, initSeats as any);

/** Viewer: request to join a specific seat index. */
router.post('/rooms/:channelName/seats/:idx/request', authenticateJWT as any, requestSeat as any);

/** Host: accept a pending seat request. */
router.post('/rooms/:channelName/seats/:idx/accept', authenticateJWT as any, acceptSeat as any);

/** Host: reject a pending seat request. */
router.post('/rooms/:channelName/seats/:idx/reject', authenticateJWT as any, rejectSeat as any);

/** Occupant or host: vacate a seat. */
router.post('/rooms/:channelName/seats/:idx/leave', authenticateJWT as any, leaveSeat as any);

/** Host: remotely mute / unmute a seat's microphone. */
router.patch('/rooms/:channelName/seats/:idx/mute', authenticateJWT as any, muteSeat as any);

/** Host: grant or revoke camera permission for a seat. */
router.patch('/rooms/:channelName/seats/:idx/cam', authenticateJWT as any, setCamPermission as any);

/** Any authenticated user: get a fresh seat-aware Agora token. */
router.get('/rooms/:channelName/seat-token', authenticateJWT as any, getSeatToken as any);

// ─────────────────────────────────────────────
// NEW: Side callers (single-host stream overlay)
// ─────────────────────────────────────────────

/** Viewer: request to appear as a side caller. */
router.post('/rooms/:channelName/side-callers/request', authenticateJWT as any, requestSideCaller as any);

/** Host: accept a side caller by their Agora UID. */
router.post('/rooms/:channelName/side-callers/:uid/accept', authenticateJWT as any, acceptSideCaller as any);

/** Host: remove a side caller by their Agora UID. */
router.post('/rooms/:channelName/side-callers/:uid/remove', authenticateJWT as any, removeSideCaller as any);

// ─────────────────────────────────────────────
// NEW: VIP list management
// ─────────────────────────────────────────────

/** Host: update the VIP list for the room. */
router.post('/rooms/:channelName/vips', authenticateJWT as any, setVips as any);

export default router;
