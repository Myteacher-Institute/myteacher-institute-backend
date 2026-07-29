import { Course } from "../models/course.model";
import { cacheGet, cacheSet, cacheDelPattern } from "../config/redis";
import mongoose from "mongoose";

export const fetchInstructorStudents = async (instructorId: string) => {
    try {
        const cacheKey = `instructor:${instructorId}:students`;

        // Try to get from cache first
        const cachedData = await cacheGet(cacheKey);
        if (cachedData) {
            console.log('📦 Serving instructor students from cache');
            return { success: true, data: cachedData };
        }

        // Fetch courses with only courseName and appliedUsers for performance
        const courses = await Course.find(
            { "instructorDetails.userId": instructorId },
            {
                courseName: 1,
                appliedUsers: 1
            }
        ).lean();

        // Cache the result for 5 minutes (300 seconds)
        await cacheSet(cacheKey, courses, 300);

        return { success: true, data: courses };
    } catch (error) {
        console.error('Error fetching instructor students:', error);
        return { success: false, message: 'Failed to fetch students' };
    }
};

export const invalidateInstructorStudentsCache = async (instructorId: string) => {
    try {
        await cacheDelPattern(`instructor:${instructorId}:students`);
        console.log('🗑️ Invalidated instructor students cache');
    } catch (error) {
        console.error('Error invalidating cache:', error);
    }
};
