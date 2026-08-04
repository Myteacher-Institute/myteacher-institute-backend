import mongoose from 'mongoose';
import { ICourse } from '../types';

export const courseSchema = new mongoose.Schema<ICourse>({
    courseName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    chapters: [
        {
            title: String,
            explanation: String,
            videos: [
                {
                    videoUrl: String,
                    videoTitle: String,
                    videoDescription: String,
                    videoDuration: Number,
                    isProgrammingVideo: Boolean,
                    isPreview: Boolean
                }
            ],
            programmingCodes: [
                {
                    code: String,
                    language: String,
                    explanation: String,
                    fileName: String
                }
            ],
            assets: [
                {
                    name: String,
                    url: String
                }
            ],
            quizzes: [
                {
                    title: String,
                    questions: [
                        {
                            question: String,
                            options: [
                                {
                                    option: String,
                                    isCorrect: Boolean
                                }
                            ],
                            correctAnswer: String
                        }
                    ]
                }
            ]
        }
    ],
    courseVideos: [
        {
            videoUrl: String,
            videoTitle: String,
            videoDescription: String,
            videoDuration: Number,
            isProgrammingVideo: Boolean,
            isPreview: Boolean
        }
    ],
    programmingCodes: [
        {
            code: String,
            language: String,
            explanation: String,
            fileName: String
        }
    ],
    assets: [
        {
            name: String,
            url: String
        }
    ],
    quizzes: [
        {
            title: String,
            questions: [
                {
                    question: String,
                    options: [
                        {
                            option: String,
                            isCorrect: Boolean
                        }
                    ],
                    correctAnswer: String
                }
            ]
        }
    ],
    courseRequirements: [String],
    appliedUsers: [
        {
            userId: mongoose.Types.ObjectId,
            userName: String,
            userEmail: String,
            ipAddress: String,
            appliedAt: Date
        }
    ],
    ratings: [
        {
            userId: mongoose.Types.ObjectId,
            userName: String,
            rating: Number,
            comment: String,
            ratedAt: Date
        }
    ],
    averageRating: {
        type: Number,
        default: 0
    },
    price: {
        type: Number,
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    certificate: {
        type: String,
        required: true
    },
    instructorDetails: {
        userId: mongoose.Types.ObjectId,
        name: String,
        email: String,
        profilePicture: String
    }
}, {
    timestamps: true
})

export const Course = mongoose.model('Course', courseSchema)