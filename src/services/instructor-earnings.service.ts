import { Course } from "../models/course.model";
import { Instructor } from "../models/instructor.model";
import { cacheGet, cacheSet, cacheDelPattern } from "../config/redis";
import mongoose from "mongoose";

export const fetchInstructorEarnings = async (instructorId: string) => {
    try {
        const cacheKey = `instructor:${instructorId}:earnings`;

        // Try to get from cache first
        const cachedData = await cacheGet(cacheKey);
        if (cachedData) {
            console.log('📦 Serving instructor earnings from cache');
            return { success: true, data: cachedData };
        }

        // moneyMade is the single source of truth for what the instructor has
        // actually earned — it is credited (70% share) on every paid course and
        // mentorship, so totals must not be re-derived from price × students.
        const instructor = await Instructor.findById(instructorId).select('moneyMade').lean();
        const moneyMade = instructor?.moneyMade ?? 0;

        // Fetch courses with only price and appliedUsers for performance
        const courses = await Course.find(
            { "instructorDetails.userId": instructorId },
            {
                courseName: 1,
                price: 1,
                appliedUsers: 1,
                createdAt: 1
            }
        ).lean();

        // Course breakdown for display (per-course rows)
        const coursesEarnings = courses.map(course => {
            const studentCount = course.appliedUsers?.length || 0;
            const courseRevenue = course.price * studentCount;
            const instructorShare = courseRevenue * 0.7; // 70% for instructor
            const companyShare = courseRevenue * 0.3; // 30% for company

            return {
                _id: course._id,
                courseName: course.courseName,
                price: course.price,
                studentCount,
                totalRevenue: courseRevenue,
                instructorShare,
                companyShare
            };
        });

        // Authoritative totals come from the instructor's moneyMade field
        const totalRevenue = moneyMade;
        const totalInstructorEarnings = moneyMade;
        const totalCompanyEarnings = Math.round(moneyMade * 0.3 / 0.7);
        const totalStudents = coursesEarnings.reduce((sum, course) => sum + course.studentCount, 0);

        // Calculate monthly earnings (last 6 months)
        const monthlyEarnings = calculateMonthlyEarnings(courses);

        const earningsData = {
            totalRevenue,
            totalInstructorEarnings,
            totalCompanyEarnings,
            totalStudents,
            courses: coursesEarnings,
            monthlyEarnings
        };

        // Cache the result for 5 minutes (300 seconds)
        await cacheSet(cacheKey, earningsData, 300);

        return { success: true, data: earningsData };
    } catch (error) {
        console.error('Error fetching instructor earnings:', error);
        return { success: false, message: 'Failed to fetch earnings' };
    }
};

const calculateMonthlyEarnings = (courses: any[]) => {
    const monthlyData: Record<string, { revenue: number; instructorEarnings: number }> = {};
    const months = [];
    const now = new Date();

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        months.push(monthKey);
        monthlyData[monthKey] = { revenue: 0, instructorEarnings: 0 };
    }

    // Calculate earnings per month based on appliedUsers.appliedAt
    courses.forEach(course => {
        if (course.appliedUsers) {
            course.appliedUsers.forEach((user: any) => {
                if (user.appliedAt) {
                    const appliedDate = new Date(user.appliedAt);
                    const monthKey = appliedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                    
                    if (monthlyData[monthKey]) {
                        monthlyData[monthKey].revenue += course.price;
                        monthlyData[monthKey].instructorEarnings += course.price * 0.7;
                    }
                }
            });
        }
    });

    return months.map(month => ({
        month,
        revenue: monthlyData[month].revenue,
        instructorEarnings: monthlyData[month].instructorEarnings
    }));
};

export const invalidateInstructorEarningsCache = async (instructorId: string) => {
    try {
        await cacheDelPattern(`instructor:${instructorId}:earnings`);
        console.log('🗑️ Invalidated instructor earnings cache');
    } catch (error) {
        console.error('Error invalidating cache:', error);
    }
};
