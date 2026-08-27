import mongoose from 'mongoose';

export interface IMentorshipRequest {
    studentId: mongoose.Types.ObjectId;
    instructorId: mongoose.Types.ObjectId;
    skillCategory: string;
    learningGoal: string;
    skillLevel: 'Beginner' | 'Intermediate' | 'Advanced';
    mentorshipType: 'Private' | 'Group';
    budgetRange: string;
    availability: string;
    additionalNotes?: string;
    selectedMentor: mongoose.Types.ObjectId;
    status: 'pending' | 'accepted' | 'rejected' | 'paid' | 'active' | 'ended';
    // Set by the instructor when accepting — schedule shown to the student
    availableTime?: string;
    programDuration?: string;
    // Computed from programDuration + acceptedAt — when the program expires
    programEndDate?: Date;
    paymentReference?: string;
    paymentStatus?: 'pending' | 'successful' | 'failed' | 'cancelled';
    amountPaid?: number;
    createdAt: Date;
    updatedAt: Date;
}

const mentorshipRequestSchema = new mongoose.Schema<IMentorshipRequest>({
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
    skillCategory: {
        type: String,
        required: true
    },
    learningGoal: {
        type: String,
        required: true
    },
    skillLevel: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced'],
        required: true
    },
    mentorshipType: {
        type: String,
        enum: ['Private', 'Group'],
        required: true
    },
    budgetRange: {
        type: String
    },
    availability: {
        type: String
    },
    additionalNotes: {
        type: String
    },
    selectedMentor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Instructor',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'paid', 'active', 'ended'],
        default: 'pending'
    },
    availableTime: {
        type: String,
        trim: true
    },
    programDuration: {
        type: String,
        trim: true
    },
    programEndDate: {
        type: Date,
    },
    paymentReference: {
        type: String
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'successful', 'failed', 'cancelled']
    },
    amountPaid: {
        type: Number
    }
}, {
    timestamps: true
});

// Index for efficient queries
mentorshipRequestSchema.index({ studentId: 1, status: 1 });
mentorshipRequestSchema.index({ instructorId: 1, status: 1 });

// Efficiently find expired programs that need to be marked as ended
mentorshipRequestSchema.index({ status: 1, programEndDate: 1 });

const MentorshipRequest = mongoose.model<IMentorshipRequest>('MentorshipRequest', mentorshipRequestSchema);

export default MentorshipRequest;
