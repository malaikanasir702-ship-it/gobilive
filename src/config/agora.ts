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
 *  - Host              → PUBLISHER, uid = seatIndexToAgoraUid(0) = 1000
 *                        (matches seat[0].agoraUid stored in DB so viewers
 *                         can render the host's video stream as a remote view)
 *  - Seated occupant   → PUBLISHER with the seat's pre-assigned agoraUid
 *  - Non-seated user   → SUBSCRIBER, uid = userIdToAgoraUid(userId)
 *                        (unique per-user uid avoids uid=0 collisions)
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
    // Fallback: return a subscriber token so the client can still join as viewer
    const fallbackUid = userIdToAgoraUid(userId);
    return {
      uid: fallbackUid,
      token: appId && certificate
        ? buildAgoraRtcToken(channelName, fallbackUid, 'subscriber', expireSeconds)
        : '',
      role: 'subscriber',
      isHost: false,
      hasSeat: false,
      seatIndex: -1,
      isAudioOnly: false,
    };
  }

  // ── Host check ──
  // Host joins with uid=1000 (= seatIndexToAgoraUid(0)) so that viewers
  // can subscribe to the host stream using the agoraUid stored in seat[0].
  // Previously uid=0 was used here which caused two problems:
  //   1. Agora VideoViewController.remote() asserts uid != 0 → crash
  //   2. Viewers subscribing to seat[0].agoraUid (1000) got no stream
  if (room.hostId.toString() === userId) {
    const hostUid = seatIndexToAgoraUid(0); // = 1000
    const token = buildAgoraRtcToken(channelName, hostUid, 'publisher', expireSeconds);
    return {
      uid: hostUid,
      token,
      role: 'publisher',
      isHost: true,
      hasSeat: true,
      seatIndex: 0,
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
  // Use a stable numeric UID derived from the userId string so that:
  //   - Each viewer has a unique non-zero UID (avoids uid=0 collisions)
  //   - The UID is deterministic across token refreshes
  const viewerUid = userIdToAgoraUid(userId);
  const token = buildAgoraRtcToken(channelName, viewerUid, 'subscriber', expireSeconds);
  return {
    uid: viewerUid,
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
 * the host (uid=1000) or other seats.  Range: 1000–1999.
 * This is purely additive and can be called without a DB round-trip.
 */
export function seatIndexToAgoraUid(seatIndex: number): number {
  // 1000 + seatIndex ensures non-zero, non-overlapping UIDs per room
  return 1000 + seatIndex;
}

/**
 * Derives a stable, unique numeric Agora UID (range: 2000000–2999999)
 * from a MongoDB ObjectId string so that audience members each get a
 * distinct non-zero UID.  This avoids the uid=0 collision when multiple
 * viewers join simultaneously.
 *
 * Uses the last 6 hex digits of the ObjectId (24-char hex string) mapped
 * into the range [2_000_000, 2_999_999].
 */
export function userIdToAgoraUid(userId: string): number {
  // Take the last 6 hex chars of the ObjectId (or userId string)
  const hex = userId.replace(/[^0-9a-fA-F]/g, '').slice(-6) || '000001';
  const raw = parseInt(hex, 16); // 0 – 16_777_215
  // Map into 2_000_000 – 2_999_999 (avoids seat range 1000–1999)
  return 2_000_000 + (raw % 1_000_000);
}
