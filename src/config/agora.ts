import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

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

  const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
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
