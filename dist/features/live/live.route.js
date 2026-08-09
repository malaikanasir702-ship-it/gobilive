"use strict";
/**
 * live.route.ts
 *
 * All existing routes are preserved untouched.
 * New /seats, /side-callers, /vips, and /seat-token routes are appended
 * below the existing routes so there is zero risk of breaking changes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
// ── Existing controller (untouched) ──
const live_controller_1 = require("./live.controller");
// ── NEW: Seat management controller ──
const seat_controller_1 = require("./seat.controller");
const router = (0, express_1.Router)();
// ─────────────────────────────────────────────
// EXISTING ROUTES (untouched)
// ─────────────────────────────────────────────
router.get('/rooms', auth_middleware_1.authenticateJWT, live_controller_1.getActiveRooms);
router.get('/my-sessions', auth_middleware_1.authenticateJWT, live_controller_1.getMySessions);
router.post('/rooms', auth_middleware_1.authenticateJWT, live_controller_1.createRoom);
router.get('/rooms/:channelName/agora', auth_middleware_1.authenticateJWT, live_controller_1.getAgoraCredentials);
router.post('/rooms/:channelName/end', auth_middleware_1.authenticateJWT, live_controller_1.endRoom);
router.post('/rooms/:channelName/pk/match', auth_middleware_1.authenticateJWT, live_controller_1.findPkOpponent);
/** Host: get list of live hosts available for PK invite (searchable). */
router.get('/rooms/pk/eligible', auth_middleware_1.authenticateJWT, live_controller_1.getPkEligibleHosts);
router.post('/rooms/:channelName/kick', auth_middleware_1.authenticateJWT, live_controller_1.kickViewer);
router.get('/rooms/:channelName/summary', live_controller_1.getSessionSummary);
// Like, save, hide, report
router.post('/rooms/:channelName/like', auth_middleware_1.authenticateJWT, live_controller_1.likeRoom);
router.post('/rooms/:channelName/save', auth_middleware_1.authenticateJWT, live_controller_1.saveRoom);
router.post('/creators/hide', auth_middleware_1.authenticateJWT, live_controller_1.hideCreator);
router.post('/rooms/:channelName/report', auth_middleware_1.authenticateJWT, live_controller_1.reportRoom);
// Host: upload a stream snapshot URL for discovery card preview
router.patch('/rooms/:channelName/thumbnail', auth_middleware_1.authenticateJWT, live_controller_1.updateThumbnail);
// ─────────────────────────────────────────────
// NEW: Multi-broadcast seat management
// ─────────────────────────────────────────────
/** Get current seat/side-caller/VIP state (public – viewer can read). */
router.get('/rooms/:channelName/seats', auth_middleware_1.authenticateJWT, seat_controller_1.getSeats);
/** Host: initialise seat layout when starting a multi-broadcast room. */
router.post('/rooms/:channelName/seats/init', auth_middleware_1.authenticateJWT, seat_controller_1.initSeats);
/** Viewer: request to join a specific seat index. */
router.post('/rooms/:channelName/seats/:idx/request', auth_middleware_1.authenticateJWT, seat_controller_1.requestSeat);
/** Host: accept a pending seat request. */
router.post('/rooms/:channelName/seats/:idx/accept', auth_middleware_1.authenticateJWT, seat_controller_1.acceptSeat);
/** Host: reject a pending seat request. */
router.post('/rooms/:channelName/seats/:idx/reject', auth_middleware_1.authenticateJWT, seat_controller_1.rejectSeat);
/** Occupant or host: vacate a seat. */
router.post('/rooms/:channelName/seats/:idx/leave', auth_middleware_1.authenticateJWT, seat_controller_1.leaveSeat);
/** Host: remotely mute / unmute a seat's microphone. */
router.patch('/rooms/:channelName/seats/:idx/mute', auth_middleware_1.authenticateJWT, seat_controller_1.muteSeat);
/** Host: grant or revoke camera permission for a seat. */
router.patch('/rooms/:channelName/seats/:idx/cam', auth_middleware_1.authenticateJWT, seat_controller_1.setCamPermission);
/** Any authenticated user: get a fresh seat-aware Agora token. */
router.get('/rooms/:channelName/seat-token', auth_middleware_1.authenticateJWT, seat_controller_1.getSeatToken);
// ─────────────────────────────────────────────
// NEW: Side callers (single-host stream overlay)
// ─────────────────────────────────────────────
/** Viewer: request to appear as a side caller. */
router.post('/rooms/:channelName/side-callers/request', auth_middleware_1.authenticateJWT, seat_controller_1.requestSideCaller);
/** Host: accept a side caller by their Agora UID. */
router.post('/rooms/:channelName/side-callers/:uid/accept', auth_middleware_1.authenticateJWT, seat_controller_1.acceptSideCaller);
/** Host: remove a side caller by their Agora UID. */
router.post('/rooms/:channelName/side-callers/:uid/remove', auth_middleware_1.authenticateJWT, seat_controller_1.removeSideCaller);
// ─────────────────────────────────────────────
// NEW: VIP list management
// ─────────────────────────────────────────────
/** Host: update the VIP list for the room. */
router.post('/rooms/:channelName/vips', auth_middleware_1.authenticateJWT, seat_controller_1.setVips);
exports.default = router;
