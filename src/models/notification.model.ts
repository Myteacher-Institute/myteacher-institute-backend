import mongoose from 'mongoose';

export interface INotification {
    recipientId: mongoose.Types.ObjectId;
    recipientType: 'admin' | 'instructor' | 'user';
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    relatedId?: mongoose.Types.ObjectId;
    relatedType?: string;
    createdAt: Date;
}

const notificationSchema = new mongoose.Schema<INotification>({
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'recipientType'
    },
    recipientType: {
        type: String,
        enum: ['admin', 'instructor', 'user'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['info', 'success', 'warning', 'error'],
        default: 'info'
    },
    read: {
        type: Boolean,
        default: false
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId
    },
    relatedType: {
        type: String
    }
}, {
    timestamps: true
});

// Index for efficient queries
notificationSchema.index({ recipientId: 1, recipientType: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, recipientType: 1, createdAt: -1 });

const Notification = mongoose.model<INotification>('Notification', notificationSchema);

export default Notification;
