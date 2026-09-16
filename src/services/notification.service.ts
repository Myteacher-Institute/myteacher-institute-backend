import { Notification } from '../models';
import { INotification } from '../models/notification.model';
import logger from '../utils';
import { triggerToUser } from '../config/pusher';

export const createNotification = async (data: {
    recipientId: string;
    recipientType: 'admin' | 'instructor' | 'user';
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    relatedId?: string;
    relatedType?: string;
}): Promise<INotification> => {
    try {
        const notification = await Notification.create({
            recipientId: data.recipientId,
            recipientType: data.recipientType,
            title: data.title,
            message: data.message,
            type: data.type || 'info',
            relatedId: data.relatedId,
            relatedType: data.relatedType,
        });

        // Emit real-time notification via Pusher
        try {
            triggerToUser(data.recipientId, 'new-notification', {
                notification: {
                    _id: notification._id.toString(),
                    recipientId: notification.recipientId.toString(),
                    recipientType: notification.recipientType,
                    title: notification.title,
                    message: notification.message,
                    type: notification.type,
                    read: notification.read,
                    relatedId: notification.relatedId?.toString(),
                    relatedType: notification.relatedType,
                    createdAt: notification.createdAt
                }
            });

            // Emit updated unread count
            const unreadCount = await getUnreadNotificationsCount(data.recipientId, data.recipientType);
            triggerToUser(data.recipientId, 'unread-count-update', { count: unreadCount });
        } catch (pusherError) {
            logger.error(`Error emitting notification via Pusher:  ${(pusherError as any)}`);
            // Don't throw - notification was created successfully
        }

        return notification;
    } catch (error) {
        logger.error(`Error creating notification: ${(error as Error)?.message ?? error}`);
        throw error;
    }
};

export const getNotificationsByRecipient = async (
    recipientId: string,
    recipientType: 'admin' | 'instructor' | 'user',
    limit: number = 20,
    skip: number = 0
): Promise<{ notifications: INotification[]; total: number }> => {
    try {
        const notifications = await Notification.find({
            recipientId,
            recipientType,
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .exec();

        const total = await Notification.countDocuments({
            recipientId,
            recipientType,
        });

        return { notifications, total };
    } catch (error) {
        logger.error(`Error fetching notifications: ${(error as Error)?.message ?? error}`);
        throw error;
    }
};

export const getUnreadNotificationsCount = async (
    recipientId: string,
    recipientType: 'admin' | 'instructor' | 'user'
): Promise<number> => {
    try {
        const count = await Notification.countDocuments({
            recipientId,
            recipientType,
            read: false,
        });
        return count;
    } catch (error) {
        logger.error(`Error fetching unread count: ${(error as Error)?.message ?? error}`);
        throw error;
    }
};

export const markNotificationAsRead = async (
    notificationId: string,
    recipientId: string
): Promise<INotification | null> => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, recipientId },
            { read: true },
            { returnDocument: 'after' }
        );
        return notification;
    } catch (error) {
        logger.error(`Error marking notification as read: ${(error as Error)?.message ?? error}`);
        throw error;
    }
};

export const markAllNotificationsAsRead = async (
    recipientId: string,
    recipientType: 'admin' | 'instructor' | 'user'
): Promise<{ modifiedCount: number }> => {
    try {
        const result = await Notification.updateMany(
            { recipientId, recipientType, read: false },
            { read: true }
        );
        return { modifiedCount: result.modifiedCount };
    } catch (error) {
        logger.error(`Error marking all notifications as read: ${(error as Error)?.message ?? error}`);
        throw error;
    }
};

export const deleteNotification = async (
    notificationId: string,
    recipientId: string
): Promise<INotification | null> => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: notificationId,
            recipientId,
        });
        return notification;
    } catch (error) {
        logger.error(`Error deleting notification: ${(error as Error)?.message ?? error}`);
        throw error;
    }
};

export const deleteAllNotifications = async (
    recipientId: string,
    recipientType: 'admin' | 'instructor' | 'user'
): Promise<{ deletedCount: number }> => {
    try {
        const result = await Notification.deleteMany({
            recipientId,
            recipientType,
        });
        return { deletedCount: result.deletedCount };
    } catch (error) {
        logger.error(`Error deleting all notifications: ${(error as Error)?.message ?? error}`);
        throw error;
    }
};

export const cleanupOldNotifications = async (days: number = 30): Promise<{ deletedCount: number }> => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const result = await Notification.deleteMany({
            createdAt: { $lt: cutoffDate },
        });
        return { deletedCount: result.deletedCount };
    } catch (error) {
        logger.error(`Error cleaning up old notifications: ${(error as Error)?.message ?? error}`);
        throw error;
    }
};
