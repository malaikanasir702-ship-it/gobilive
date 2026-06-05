import { Types } from 'mongoose';
import { ActivityLog } from './activity-log.model';

interface LogActivityParams {
  actorId: string | Types.ObjectId;
  actorRole: string;
  actionType: string;
  targetEntityType: string;
  targetEntityId: string;
  description: string;
  metadata?: Record<string, any>;
}

/**
 * Fire-and-forget activity logger. Never throws — logs errors to console only.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await ActivityLog.create({
      actorId: params.actorId,
      actorRole: params.actorRole,
      actionType: params.actionType,
      targetEntityType: params.targetEntityType,
      targetEntityId: params.targetEntityId,
      description: params.description,
      metadata: params.metadata,
    });
  } catch (err) {
    console.error('[ActivityLog] Failed to write log:', err);
  }
}
