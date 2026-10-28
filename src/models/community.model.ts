import mongoose, { Schema } from 'mongoose';

const communityPostSchema = new Schema({
    content: {
        type: String,
        required: true
    },
    mediaType: {
        type: String,
        enum: ['text', 'image', 'video'],
        default: 'text'
    },
    mediaUrl: {
        type: String
    },
    likes: [{
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        likedAt: {
            type: Date,
            default: Date.now
        }
    }],
    comments: [{
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        userName: String,
        comment: String,
        commentedAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

const communitySchema = new Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    creator: {
        type: Schema.Types.ObjectId,
        ref: 'Instructor',
        required: true
    },
    creatorName: {
        type: String,
        required: true
    },
    creatorEmail: {
        type: String,
        required: true
    },
    profilePicture: {
        type: String
    },
    coverImage: {
        type: String
    },
    members: [{
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        userName: String,
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    posts: [communityPostSchema],
    courses: [{
        courseId: {
            type: Schema.Types.ObjectId,
            ref: 'Course'
        },
        courseName: String,
        category: String,
        price: Number
    }],
    followerCount: {
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

export const Community = mongoose.model('Community', communitySchema);
