import mongoose from 'mongoose';

const courseAnalyticsSchema = new mongoose.Schema({
    instructorId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Instructor'
    },
    month: {
        type: String, // Format: "2024-01", "2024-02", etc.
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    totalStudents: {
        type: Number,
        default: 0
    },
    totalCourses: {
        type: Number,
        default: 0
    },
    totalEarnings: {
        type: Number,
        default: 0
    },
    averageRating: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Create a compound index to ensure one record per instructor per month
courseAnalyticsSchema.index({ instructorId: 1, month: 1, year: 1 }, { unique: true });

export const CourseAnalytics = mongoose.model('CourseAnalytics', courseAnalyticsSchema);
