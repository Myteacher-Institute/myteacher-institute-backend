import mongoose, { Schema } from "mongoose";

export interface IAnnouncement {
    title: string;
    content: string;
    createdBy: mongoose.Types.ObjectId;
    targetAudience: 'all' | 'instructors' | 'students';
    priority: 'low' | 'medium' | 'high';
    isActive: boolean;
    readBy: Array<{
        userId: mongoose.Types.ObjectId;
        readAt: Date;
    }>;
    hiddenBy: Array<{
        userId: mongoose.Types.ObjectId;
        hiddenAt: Date;
    }>;
    createdAt: Date;
    updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    targetAudience: {
        type: String,
        enum: ['all', 'instructors', 'students'],
        default: 'all'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    readBy: [{
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'Instructor'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    hiddenBy: [{
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'Instructor'
        },
        hiddenAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Index for efficient queries
announcementSchema.index({ targetAudience: 1, isActive: 1 });
announcementSchema.index({ 'readBy.userId': 1 });
announcementSchema.index({ 'hiddenBy.userId': 1 });

const Announcement = mongoose.model<IAnnouncement>('Announcement', announcementSchema);

export default Announcement;