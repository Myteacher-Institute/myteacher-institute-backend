import mongoose, { Schema } from 'mongoose';

const blogPostSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    excerpt: {
        type: String,
        required: true
    },
    coverImage: {
        type: String
    },
    category: {
        type: String,
        enum: ['Web Development', 'Data Science', 'Design', 'Business'],
        required: true
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    authorName: {
        type: String,
        required: true
    },
    authorEmail: {
        type: String,
        required: true
    },
    authorRole: {
        type: String,
        enum: ['admin', 'instructor'],
        required: true
    },
    authorProfilePicture: {
        type: String
    },
    tags: [{
        type: String
    }],
    readTime: {
        type: String,
        required: true
    },
    published: {
        type: Boolean,
        default: false
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
    views: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

export const BlogPost = mongoose.model('BlogPost', blogPostSchema);
