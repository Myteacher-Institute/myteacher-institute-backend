import InstructorReport from "../models/instructor-report.model";
import { Instructor } from "../models/instructor.model";
import User from "../models/user.model";
import { createNotification } from "./notification.service";
import { emitToUser } from "../config/socket";

// ============ Student: Report an Instructor ============
export const reportInstructor = async (
    studentId: string,
    instructorId: string,
    reason: string,
    description: string,
    mentorshipId?: string
) => {
    try {
        // Verify student exists
        const student = await User.findById(studentId);
        if (!student) {
            return { success: false, message: 'Student not found' };
        }

        // Verify instructor exists
        const instructor = await Instructor.findById(instructorId);
        if (!instructor) {
            return { success: false, message: 'Instructor not found' };
        }

        // Check if student already has a pending report for this instructor
        const existingReport = await InstructorReport.findOne({
            studentId,
            instructorId,
            status: { $in: ['pending', 'reviewing'] }
        });

        if (existingReport) {
            return { success: false, message: 'You already have a pending report for this instructor' };
        }

        // Create the report
        const report = await InstructorReport.create({
            studentId,
            instructorId,
            instructorName: instructor.name,
            reason,
            description,
            mentorshipId,
            status: 'pending'
        });

        // Notify admin (you would need to implement admin notification logic)
        // For now, we'll create a notification for the instructor
        await createNotification({
            recipientId: instructorId,
            recipientType: 'instructor',
            title: 'report_filed',
            message: `A student has filed a report against you. Reason: ${reason}`,
            relatedType: 'report'
        });

        // Emit real-time notification to instructor
        emitToUser(instructorId, 'report:filed', {
            reportId: report._id,
            reason,
            studentName: student.name
        });

        return {
            success: true,
            message: 'Report submitted successfully. An admin will review it shortly.',
            report
        };
    } catch (error) {
        console.error('Report instructor error:', error);
        return { success: false, message: 'Failed to submit report' };
    }
};

// ============ Admin: Get All Reports ============
export const getAllInstructorReports = async (status?: string) => {
    try {
        const filter: any = {};
        if (status && status !== 'all') {
            filter.status = status;
        }

        const reports = await InstructorReport.find(filter)
            .populate('studentId', 'name email profilePicture')
            .populate('instructorId', 'name email profilePicture')
            .populate('mentorshipId', 'status programDuration')
            .sort({ createdAt: -1 });

        return {
            success: true,
            reports
        };
    } catch (error) {
        console.error('Get all reports error:', error);
        return { success: false, message: 'Failed to fetch reports' };
    }
};

// ============ Admin: Update Report Status ============
export const updateReportStatus = async (
    reportId: string,
    status: 'pending' | 'reviewing' | 'resolved' | 'dismissed',
    adminNotes?: string
) => {
    try {
        const report = await InstructorReport.findById(reportId);
        if (!report) {
            return { success: false, message: 'Report not found' };
        }

        report.status = status;
        if (adminNotes) {
            report.adminNotes = adminNotes;
        }
        await report.save();

        // Notify student about the status update
        await createNotification({
            recipientId: report.studentId.toString(),
            recipientType: 'user',
            title: 'report_updated',
            message: `Your report against ${report.instructorName} has been updated to: ${status}`,
            relatedType: 'report'
        });

        // Notify instructor if resolved
        if (status === 'resolved' || status === 'dismissed') {
            await createNotification({
                recipientId: report.instructorId.toString(),
                recipientType: 'instructor',
                title: 'report_resolved',
                message: `The report filed against you has been ${status}`,
                relatedType: 'report'
            });
        }

        return {
            success: true,
            message: 'Report status updated successfully',
            report
        };
    } catch (error) {
        console.error('Update report status error:', error);
        return { success: false, message: 'Failed to update report status' };
    }
};

// ============ Student: Get Own Reports ============
export const getStudentReports = async (studentId: string) => {
    try {
        const reports = await InstructorReport.find({ studentId })
            .populate('instructorId', 'name email profilePicture')
            .sort({ createdAt: -1 });

        return {
            success: true,
            reports
        };
    } catch (error) {
        console.error('Get student reports error:', error);
        return { success: false, message: 'Failed to fetch your reports' };
    }
};

// ============ Instructor: Get Reports Against Them ============
export const getInstructorReports = async (instructorId: string) => {
    try {
        const reports = await InstructorReport.find({ instructorId })
            .populate('studentId', 'name email profilePicture')
            .sort({ createdAt: -1 });

        return {
            success: true,
            reports
        };
    } catch (error) {
        console.error('Get instructor reports error:', error);
        return { success: false, message: 'Failed to fetch reports' };
    }
};