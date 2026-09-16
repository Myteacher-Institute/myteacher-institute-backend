import mongoose from 'mongoose';

export interface IMessage {
    chatId: mongoose.Types.ObjectId;
    senderId: mongoose.Types.ObjectId;
    senderType: 'user' | 'instructor';
    content?: string;
    attachmentUrl?: string;
    attachmentData?: string;
    attachmentType?: 'image' | 'voice' | 'file';
    attachmentName?: string;
    attachmentFileId?: mongoose.Types.ObjectId;
    readBy: mongoose.Types.ObjectId[];
    edited: boolean;
    isDeleted: boolean;
    deletedFor: mongoose.Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const messageSchema = new mongoose.Schema<IMessage>({
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat',
        required: true,
        index: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    senderType: {
        type: String,
        enum: ['user', 'instructor'],
        required: true
    },
    content: {
        type: String,
        trim: true
    },
    attachmentUrl: {
        type: String
    },
    attachmentData: {
        type: String,
        trim: true
    },
    attachmentType: {
        type: String,
        enum: ['image', 'voice', 'file']
    },
    attachmentName: {
        type: String,
        trim: true
    },
    attachmentFileId: {
        type: mongoose.Schema.Types.ObjectId
    },
    readBy: [{
        type: mongoose.Schema.Types.ObjectId
    }],
    edited: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedFor: [{
        type: mongoose.Schema.Types.ObjectId
    }]
}, {
    timestamps: true
});

// Efficiently load a conversation and its unread counts
messageSchema.index({ chatId: 1, createdAt: 1 });

const Message = mongoose.model<IMessage>('Message', messageSchema);

export default Message;