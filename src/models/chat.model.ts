import mongoose from 'mongoose';

export interface IChat {
    mentorshipId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    instructorId: mongoose.Types.ObjectId;
    lastMessageAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const chatSchema = new mongoose.Schema<IChat>({
    mentorshipId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MentorshipRequest',
        required: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    instructorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Instructor',
        required: true
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// One active conversation per mentorship
chatSchema.index({ mentorshipId: 1 }, { unique: true });
chatSchema.index({ instructorId: 1, lastMessageAt: -1 });
chatSchema.index({ studentId: 1, lastMessageAt: -1 });

const Chat = mongoose.model<IChat>('Chat', chatSchema);

export default Chat;