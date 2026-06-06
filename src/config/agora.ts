/**
 * agora.ts — Agora token generation utilities
 *
 * Provides two token builders:
 *  1. buildAgoraRtcToken  — existing single-channel RTC token (unchanged)
 *  2. buildSeatToken      — NEW: issues tokens with Broadcaster privilege
 *     only when the user currently occupies a seat in the LiveRoom.
 *     All other callers receive Subscriber tokens so they cannot publish.
 *
 * The token expiry is intentionally short (3600 s default) and should be
 * refreshed by the client via the /rooms/:channelName/seat-token endpoint
 * before it lapses (Agora recommends refreshing at the halfway mark).
 */

import { RtcTokenBuilder, RtcRole } from 'agora-access-token';
import LiveRoom from '../features/live/live.model';

// ─────────────────────────────────────────────
// Original single-role token builder (UNCHANGED)
// ─────────────────────────────────────────────
export function buildAgoraRtcToken(
  channelName: string,
  uid: number = 0,
  role: 'publisher' | 'subscriber' = 'publisher',
  expireSeconds = 3600
): string {
  const appId = process.env.AGORA_APP_ID || '';
  const certificate = process.env.AGORA_PRIMARY_CERTIFICATE || '';

  if (!appId || !certificate) {
    return '';
  }

  const agoraRole =
    role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const privilegeExpire = Math.floor(Date.now() / 1000) + expireSeconds;

  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    certificate,
    channelName,
    uid,
    agoraRole,
    privilegeExpire
  );
}

// ─────────────────────────────────────────────
// NEW: Seat-aware dynamic token
// ─────────────────────────────────────────────

/** Result returned by buildSeatToken to the API caller. */
export interface SeatTokenResult {
  /** Agora numeric UID to use when joining */
  uid: number;
  /** The generated RTC token */
  token: string;
  /** Whether the user is joining as a broadcaster (seat holder) or subscriber */
  role: 'publisher' | 'subscriber';
  /** True if the user is the room host */
  isHost: boolean;
  /** True if the user has been assigned to a seat */
  hasSeat: boolean;
  /** Index of the seat (-1 if not seated) */
  seatIndex: number;
  /** True if the seat is audio-only (camera muted by default on join) */
  isAudioOnly: boolean;
}

/**
 * Generates an Agora RTC token appropriate for the user's current seat status.
 *
 * Logic:
 *  - Host              → PUBLISHER, uid = 0 (Agora convention for host)
 *  - Seated occupant   → PUBLISHER with the seat's pre-assigned agoraUid
 *  - Non-seated user   → SUBSCRIBER, uid = 0
 *
 * The returned `isAudioOnly` flag tells the Flutter client to call
 * `muteLocalVideoStream(true)` immediately after joining.
 */
export async function buildSeatToken(
  channelName: string,
  userId: string,
  expireSeconds = 3600
): Promise<SeatTokenResult> {
  const appId = process.env.AGORA_APP_ID || '';
  const certificate = process.env.AGORA_PRIMARY_CERTIFICATE || '';

  const room = await LiveRoom.findOne({ channelName, isActive: true });

  if (!room || !appId || !certificate) {
    // Fallback: return an empty subscriber token so the client can
    // still join the channel as a viewer even if something goes wrong.
    return {
      uid: 0,
      token: appId && certificate
        ? buildAgoraRtcToken(channelName, 0, 'subscriber', expireSeconds)
        : '',
      role: 'subscriber',
      isHost: false,
      hasSeat: false,
      seatIndex: -1,
      isAudioOnly: false,
    };
  }

  // ── Host check ──
  if (room.hostId.toString() === userId) {
    const token = buildAgoraRtcToken(channelName, 0, 'publisher', expireSeconds);
    return {
      uid: 0,
      token,
      role: 'publisher',
      isHost: true,
      hasSeat: true,   // host occupies "seat 0" conceptually
      seatIndex: -1,   // host is NOT in the seats array
      isAudioOnly: false,
    };
  }

  // ── Seated occupant check ──
  const seat = room.seats.find(
    (s) => s.userId && s.userId.toString() === userId
  );

  if (seat) {
    const token = buildAgoraRtcToken(
      channelName,
      seat.agoraUid,
      'publisher',
      expireSeconds
    );
    return {
      uid: seat.agoraUid,
      token,
      role: 'publisher',
      isHost: false,
      hasSeat: true,
      seatIndex: seat.seatIndex,
      // Camera muted by default unless host has explicitly allowed it
      isAudioOnly: seat.isAudioOnly || !seat.isCamAllowedByHost,
    };
  }

  // ── Regular audience member ──
  const token = buildAgoraRtcToken(channelName, 0, 'subscriber', expireSeconds);
  return {
    uid: 0,
    token,
    role: 'subscriber',
    isHost: false,
    hasSeat: false,
    seatIndex: -1,
    isAudioOnly: false,
  };
}

// ─────────────────────────────────────────────
// Utility: compute a deterministic Agora UID
// ─────────────────────────────────────────────
/**
 * Maps a seat index to a stable numeric Agora UID that doesn't clash with
 * the host (uid=0) or other seats.  Range: 1000–1999.
 * This is purely additive and can be called without a DB round-trip.
 */
export function seatIndexToAgoraUid(seatIndex: number): number {
  // 1000 + seatIndex ensures non-zero, non-overlapping UIDs per room
  return 1000 + seatIndex;
}
