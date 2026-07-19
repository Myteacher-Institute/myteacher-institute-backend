import { Router } from 'express';
import {
    getNotificationsByRecipient,
    getUnreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    deleteAllNotifications,
} from '../services';
import { ProtectMiddleWare } from '../middleware/protect-route';

const notificationRoute: Router = Router();

// Get notifications for authenticated user
notificationRoute.get('/', ProtectMiddleWare, async (req, res) => {
    try {
        const userId = req.userId;
        const userType = req.query.userType as 'admin' | 'instructor' | 'user' || 'user';
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = parseInt(req.query.skip as string) || 0;

        if (!userId) {
            return res.status(401).json({
                status: 'failed',
                message: 'User not authenticated'
            });
        }

        const { notifications, total } = await getNotificationsByRecipient(
            userId,
            userType,
            limit,
            skip
        );

        return res.status(200).json({
            status: 'success',
            message: 'Notifications retrieved successfully',
            notifications,
            total,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
});

// Get unread notifications count
notificationRoute.get('/unread-count', ProtectMiddleWare, async (req, res) => {
    try {
        const userId = req.userId;
        const userType = req.query.userType as 'admin' | 'instructor' | 'user' || 'user';

        if (!userId) {
            return res.status(401).json({
                status: 'failed',
                message: 'User not authenticated'
            });
        }

        const count = await getUnreadNotificationsCount(userId, userType);

        return res.status(200).json({
            status: 'success',
            message: 'Unread count retrieved successfully',
            count,
        });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
});

// Mark notification as read
notificationRoute.patch('/:notificationId/read', ProtectMiddleWare, async (req, res) => {
    try {
        const userId = req.userId;
        const { notificationId } = req.params as any;

        if (!userId) {
            return res.status(401).json({
                status: 'failed',
                message: 'User not authenticated'
            });
        }

        const notification = await markNotificationAsRead(notificationId, userId);

        if (!notification) {
            return res.status(404).json({
                status: 'failed',
                message: 'Notification not found'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Notification marked as read',
            notification,
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
});

// Mark all notifications as read
notificationRoute.patch('/read-all', ProtectMiddleWare, async (req, res) => {
    try {
        const userId = req.userId;
        const userType = req.query.userType as 'admin' | 'instructor' | 'user' || 'user';

        if (!userId) {
            return res.status(401).json({
                status: 'failed',
                message: 'User not authenticated'
            });
        }

        const { modifiedCount } = await markAllNotificationsAsRead(userId, userType);

        return res.status(200).json({
            status: 'success',
            message: 'All notifications marked as read',
            modifiedCount,
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
});

// Delete notification
notificationRoute.delete('/:notificationId', ProtectMiddleWare, async (req, res) => {
    try {
        const userId = req.userId;
        const { notificationId } = req.params as any;

        if (!userId) {
            return res.status(401).json({
                status: 'failed',
                message: 'User not authenticated'
            });
        }

        const notification = await deleteNotification(notificationId, userId);

        if (!notification) {
            return res.status(404).json({
                status: 'failed',
                message: 'Notification not found'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Notification deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
});

// Delete all notifications
notificationRoute.delete('/', ProtectMiddleWare, async (req, res) => {
    try {
        const userId = req.userId;
        const userType = req.query.userType as 'admin' | 'instructor' | 'user' || 'user';

        if (!userId) {
            return res.status(401).json({
                status: 'failed',
                message: 'User not authenticated'
            });
        }

        const { deletedCount } = await deleteAllNotifications(userId, userType);

        return res.status(200).json({
            status: 'success',
            message: 'All notifications deleted successfully',
            deletedCount,
        });
    } catch (error) {
        console.error('Error deleting all notifications:', error);
        return res.status(500).json({
            status: 'failed',
            message: 'Internal server error'
        });
    }
});

export default notificationRoute;
