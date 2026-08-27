import mongoose from 'mongoose';
import { ICourseCreationJob } from '../types';

export const courseCreationJobSchema = new mongoose.Schema<ICourseCreationJob>(
    {
        instructorId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Instructor'
        },
        jobType: {
            type: String,
            enum: ['create', 'edit'],
            default: 'create'
        },
        courseName: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'uploading', 'creating', 'completed', 'failed'],
            default: 'pending'
        },
        currentStage: {
            type: String,
            default: 'youtube-auth'
        },
        currentIndex: {
            type: Number,
            default: 0
        },
        total: {
            type: Number,
            default: 0
        },
        progressPercent: {
            type: Number,
            default: 0
        },
        videos: [
            {
                ci: Number,
                vi: Number,
                g: Number,
                filePath: String,
                originalName: String,
                title: String,
                description: String,
                videoTitle: String,
                videoDescription: String,
                videoDuration: Number,
                isProgrammingVideo: Boolean,
                isPreview: Boolean
            }
        ],
        assets: [
            {
                ci: Number,
                ai: Number,
                g: Number,
                filePath: String,
                originalName: String,
                name: String,
                mimeType: String
            }
        ],
        resultVideos: [
            {
                g: Number,
                videoId: String,
                videoUrl: String
            }
        ],
        resultAssets: [
            {
                g: Number,
                fileId: String,
                url: String
            }
        ],
        payload: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        error: {
            type: String
        },
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course'
        }
    },
    { timestamps: true }
);

courseCreationJobSchema.index({ instructorId: 1, status: 1 });

export const CourseCreationJob = mongoose.model<ICourseCreationJob>('CourseCreationJob', courseCreationJobSchema);
