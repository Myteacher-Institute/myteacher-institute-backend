import User from '../models/user.model';
import { Instructor } from '../models/instructor.model';
import { Admin } from '../models/admin.model';
import logger from '../utils';

export const setUserOnline = async (
  userId: string,
  userType: 'admin' | 'instructor' | 'user',
  socketId: string
): Promise<void> => {
  try {
    const updateData = {
      isOnline: true,
      lastSeen: new Date(),
      socketId
    };

    switch (userType) {
      case 'user':
        await User.findByIdAndUpdate(userId, updateData);
        break;
      case 'instructor':
        await Instructor.findByIdAndUpdate(userId, updateData);
        break;
      case 'admin':
        await Admin.findByIdAndUpdate(userId, updateData);
        break;
    }

    logger.info(`User ${userId} (${userType}) is now online`);
  } catch (error) {
    logger.error(`Error setting user online: ${(error as Error)?.message ?? error}`);
    throw error;
  }
};

export const setUserOffline = async (
  userId: string,
  userType: 'admin' | 'instructor' | 'user'
): Promise<void> => {
  try {
    const updateData = {
      isOnline: false,
      lastSeen: new Date(),
      socketId: undefined
    };

    switch (userType) {
      case 'user':
        await User.findByIdAndUpdate(userId, updateData);
        break;
      case 'instructor':
        await Instructor.findByIdAndUpdate(userId, updateData);
        break;
      case 'admin':
        await Admin.findByIdAndUpdate(userId, updateData);
        break;
    }

    logger.info(`User ${userId} (${userType}) is now offline`);
  } catch (error) {
    logger.error(`Error setting user offline: ${(error as Error)?.message ?? error}`);
    throw error;
  }
};

export const getUserStatus = async (
  userId: string,
  userType: 'admin' | 'instructor' | 'user'
): Promise<{ isOnline: boolean; lastSeen?: Date }> => {
  try {
    let user;

    switch (userType) {
      case 'user':
        user = await User.findById(userId).select('isOnline lastSeen');
        break;
      case 'instructor':
        user = await Instructor.findById(userId).select('isOnline lastSeen');
        break;
      case 'admin':
        user = await Admin.findById(userId).select('isOnline lastSeen');
        break;
    }

    if (!user) {
      throw new Error('User not found');
    }

    return {
      isOnline: user.isOnline || false,
      lastSeen: user.lastSeen
    };
  } catch (error) {
    logger.error(`Error getting user status: ${(error as Error)?.message ?? error}`);
    throw error;
  }
};

export const getOnlineUsers = async (
  userType: 'admin' | 'instructor' | 'user'
): Promise<Array<{ _id: string; name: string; isOnline: boolean }>> => {
  try {
    let users: any;

    switch (userType) {
      case 'user':
        users = await User.find({ isOnline: true }).select('_id name isOnline').lean();
        break;
      case 'instructor':
        users = await Instructor.find({ isOnline: true }).select('_id name isOnline').lean();
        break;
      case 'admin':
        users = await Admin.find({ isOnline: true }).select('_id name isOnline').lean();
        break;
    }

    // Convert ObjectId to string
    return (users || []).map((user: any) => ({
      _id: user._id.toString(),
      name: user.name,
      isOnline: user.isOnline
    }));
  } catch (error) {
    logger.error(`Error getting online users: ${(error as Error)?.message ?? error}`);
    throw error;
  }
};

export const cleanupOfflineUsers = async (minutes: number = 30): Promise<{ cleanedCount: number }> => {
  try {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

    const userResult = await User.updateMany(
      { isOnline: true, lastSeen: { $lt: cutoffTime } },
      { isOnline: false, socketId: undefined }
    );

    const instructorResult = await Instructor.updateMany(
      { isOnline: true, lastSeen: { $lt: cutoffTime } },
      { isOnline: false, socketId: undefined }
    );

    const adminResult = await Admin.updateMany(
      { isOnline: true, lastSeen: { $lt: cutoffTime } },
      { isOnline: false, socketId: undefined }
    );

    const totalCleaned = userResult.modifiedCount + instructorResult.modifiedCount + adminResult.modifiedCount;

    logger.info(`Cleaned up ${totalCleaned} offline users`);

    return { cleanedCount: totalCleaned };
  } catch (error) {
    logger.error(`Error cleaning up offline users: ${(error as Error)?.message ?? error}`);
    throw error;
  }
};

export const ensureOnlineStatusFields = async (
  userId: string,
  userType: 'admin' | 'instructor' | 'user'
): Promise<void> => {
  try {
    const updateData = {
      $setOnInsert: {
        isOnline: false,
        lastSeen: new Date(),
        socketId: undefined
      }
    };

    switch (userType) {
      case 'user':
        await User.updateOne({ _id: userId }, updateData, { upsert: false });
        break;
      case 'instructor':
        await Instructor.updateOne({ _id: userId }, updateData, { upsert: false });
        break;
      case 'admin':
        await Admin.updateOne({ _id: userId }, updateData, { upsert: false });
        break;
    }
  } catch (error) {
    logger.error(`Error ensuring online status fields: ${(error as Error)?.message ?? error}`);
    throw error;
  }
};
