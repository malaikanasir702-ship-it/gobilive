import { Request, Response } from 'express';
import mongoose from 'mongoose';
import LiveRoom from './live.model';
import StreamReport from './report.model';
import { buildAgoraRtcToken } from '../../config/agora';
import { getPlatformSettings } from '../settings/platform-settings.model';
import { User } from '../auth/user.model';
import { Follow } from '../auth/follow.model';
import { ensureLiveDiscoverySeed } from './live.seed';

export const getActiveRooms = async (req: Request, res: Response) => {
  try {
    const followingOnly = req.query.following === 'true';
    const category = (req.query.category as string || '').trim().toLowerCase();
    const viewerId = (req as any).user?.id;

    if (!followingOnly) {
      await ensureLiveDiscoverySeed();
    }

    // Get viewer's hidden creators list
    let hiddenHosts: string[] = [];
    if (viewerId) {
      const viewer = await User.findById(viewerId).select('hiddenCreators').lean();
      hiddenHosts = viewer?.hiddenCreators ?? [];
    }

    const filter: Record<string, unknown> = {
      isActive: true,
      privacyMode: { $ne: 'private' },
    };

    if (hiddenHosts.length > 0) {
      filter.hostUsername = { $nin: hiddenHosts };
    }

    if (followingOnly && viewerId) {
      const follows = await Follow.find({ followerId: viewerId }).select('followingId');
      const hostIds = follows.map((f) => f.followingId);
      if (hostIds.length === 0) {
        res.status(200).json({ success: true, rooms: [] });
        return;
      }
      filter.hostId = { $in: hostIds };
    }

    let rooms = await LiveRoom.find(filter)
      .sort({ viewerCount: -1, createdAt: -1 })
      .limit(50)
      .populate('hostId', 'profilePic')
      .lean() as any[];

    if (category) {
      rooms = rooms.filter(
        (r) => (r.category || '').toLowerCase() === category
      );
    }

    // Attach isLiked, isSaved, likesCount per room for current viewer
    const enriched = rooms.map((r) => ({
      ...r,
      hostProfilePic: r.hostId?.profilePic ?? '',
      likesCount: r.likedBy?.length ?? 0,
      isLiked: viewerId ? r.likedBy?.some((id: any) => id.toString() === viewerId) ?? false : false,
      isSaved: viewerId ? r.savedBy?.some((id: any) => id.toString() === viewerId) ?? false : false,
    }));

    res.status(200).json({ success: true, rooms: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createRoom = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { title, privacyMode = 'public', category = '' } = req.body;
    const settings = await getPlatformSettings();
    const dbUser = await User.findById(user.id);

    if ((dbUser?.level ?? 1) < settings.minLevelToGoLive) {
      return res.status(403).json({
        success: false,
        message: `Minimum level ${settings.minLevelToGoLive} required to go live.`,
      });
    }

    const channelName = `room_${user.id}_${Date.now()}`;
    const token = buildAgoraRtcToken(channelName, 0, 'publisher');

    const room = await LiveRoom.create({
      channelName,
      hostId: user.id,
      hostUsername: user.username,
      hostLevel: dbUser?.level ?? 1,
      title: title || `${user.username}'s Live`,
      privacyMode,
      category: category || '',
      isActive: true,
    });

    res.status(201).json({
      success: true,
      room,
      agora: {
        appId: process.env.AGORA_APP_ID || '',
        channelName: room.channelName,
        uid: 0,
        token,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAgoraCredentials = async (req: Request, res: Response) => {
  try {
    const { channelName } = req.params;
    const room = await LiveRoom.findOne({ channelName, isActive: true });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Live room not found.' });
    }

    const viewerId = (req as any).user?.id;
    if (room.blockedViewers.includes(viewerId)) {
      return res.status(403).json({ success: false, message: 'You are blocked from this stream.' });
    }

    if (room.privacyMode === 'private' && viewerId && room.hostId.toString() !== viewerId) {
      return res.status(403).json({ success: false, message: 'Private stream — host access only.' });
    }

    if (room.privacyMode === 'followers' && viewerId) {
      const follows = await Follow.findOne({ followerId: viewerId, followingId: room.hostId });
      if (!follows && room.hostId.toString() !== viewerId) {
        return res.status(403).json({ success: false, message: 'Followers only stream.' });
      }
    }

    const isHost = Boolean(viewerId && room.hostId.toString() === viewerId);
    let isOpponentHost = false;
    if (viewerId) {
      const myActiveRoom = await LiveRoom.findOne({ hostId: viewerId, isActive: true });
      if (myActiveRoom && myActiveRoom.isPKActive && myActiveRoom.opponentRoomId === room.channelName) {
        isOpponentHost = true;
      }
    }
    const role = (isHost || isOpponentHost) ? 'publisher' : 'subscriber';
    const token = buildAgoraRtcToken(room.channelName, 0, role);

    res.status(200).json({
      success: true,
      agora: {
        appId: process.env.AGORA_APP_ID || '',
        channelName: room.channelName,
        uid: 0,
        token,
        role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const endRoom = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { channelName } = req.params;

    const room = await LiveRoom.findOne({ channelName, hostId: user.id });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found or not owned by you.' });
    }

    const durationSeconds = Math.floor((Date.now() - room.createdAt.getTime()) / 1000);
    room.isActive = false;
    room.isPKActive = false;
    room.sessionSummary = {
      durationSeconds,
      totalViewers: room.peakViewers,
      giftsReceived: room.totalGifts,
      diamondsEarned: room.totalDiamondsEarned,
      endedAt: new Date(),
    };
    await room.save();

    res.status(200).json({ success: true, room, sessionSummary: room.sessionSummary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const kickViewer = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { channelName } = req.params;
    const { viewerId } = req.body;

    const room = await LiveRoom.findOne({ channelName, hostId: user.id });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    if (!room.blockedViewers.includes(viewerId)) {
      room.blockedViewers.push(viewerId);
      await room.save();
    }

    res.status(200).json({ success: true, blockedViewers: room.blockedViewers });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const findPkOpponent = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { channelName } = req.params;

    const myRoom = await LiveRoom.findOne({ channelName, hostId: user.id, isActive: true });
    if (!myRoom) {
      return res.status(404).json({ success: false, message: 'Your active room not found.' });
    }

    const opponent = await LiveRoom.findOne({
      channelName: { $ne: channelName },
      isActive: true,
      isPKActive: false,
      hostId: { $ne: user.id },
    }).sort({ viewerCount: -1, createdAt: -1 });

    if (!opponent) {
      return res.status(404).json({ success: false, message: 'No opponent available for PK right now.' });
    }

    myRoom.isPKActive = true;
    myRoom.opponentRoomId = opponent.channelName;
    myRoom.opponentHost = opponent.hostUsername;
    opponent.isPKActive = true;
    opponent.opponentRoomId = myRoom.channelName;
    opponent.opponentHost = myRoom.hostUsername;
    await myRoom.save();
    await opponent.save();

    res.status(200).json({
      success: true,
      opponent: {
        channelName: opponent.channelName,
        hostUsername: opponent.hostUsername,
        hostLevel: opponent.hostLevel,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getMySessions = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const sessions = await LiveRoom.find({ hostId: user.id, isActive: false })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    const stats = {
      totalSessions: sessions.length,
      totalLiveSeconds: sessions.reduce(
        (s, r) => s + (r.sessionSummary?.durationSeconds ?? 0),
        0
      ),
      totalDiamondsEarned: sessions.reduce(
        (s, r) => s + (r.sessionSummary?.diamondsEarned ?? r.totalDiamondsEarned ?? 0),
        0
      ),
    };

    res.status(200).json({ success: true, sessions, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getSessionSummary = async (req: Request, res: Response) => {
  try {
    const { channelName } = req.params;
    const room = await LiveRoom.findOne({ channelName }).lean();
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }
    res.status(200).json({ success: true, sessionSummary: room.sessionSummary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const likeRoom = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { channelName } = req.params;
    const userId = new mongoose.Types.ObjectId(user.id);

    const room = await LiveRoom.findOne({ channelName });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    const alreadyLiked = room.likedBy.some((id) => id.toString() === user.id);
    if (alreadyLiked) {
      room.likedBy = room.likedBy.filter((id) => id.toString() !== user.id);
    } else {
      room.likedBy.push(userId);
    }
    await room.save();

    res.status(200).json({
      success: true,
      liked: !alreadyLiked,
      likesCount: room.likedBy.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const saveRoom = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { channelName } = req.params;
    const userId = new mongoose.Types.ObjectId(user.id);

    const room = await LiveRoom.findOne({ channelName });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    const alreadySaved = room.savedBy.some((id) => id.toString() === user.id);
    if (alreadySaved) {
      room.savedBy = room.savedBy.filter((id) => id.toString() !== user.id);
    } else {
      room.savedBy.push(userId);
    }
    await room.save();

    res.status(200).json({ success: true, saved: !alreadySaved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const hideCreator = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { hostUsername } = req.body;
    if (!hostUsername) return res.status(400).json({ success: false, message: 'hostUsername required.' });

    await User.findByIdAndUpdate(user.id, {
      $addToSet: { hiddenCreators: hostUsername },
    });

    res.status(200).json({ success: true, message: `@${hostUsername} hidden from your discovery.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const reportRoom = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const channelName = (req.params as any).channelName as string;
    const { reason } = req.body;

    if (!reason) return res.status(400).json({ success: false, message: 'reason required.' });

    const room = await LiveRoom.findOne({ channelName }).lean();
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    await StreamReport.create({
      reporterUsername: user.username,
      hostUsername: room.hostUsername,
      roomId: channelName,
      reason,
    });

    res.status(201).json({ success: true, message: 'Report submitted. Our team will review it.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
