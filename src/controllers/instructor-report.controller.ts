import { Request, Response } from 'express';
import {
    reportInstructor,
    getAllInstructorReports,
    updateReportStatus,
    getStudentReports,
    getInstructorReports,
} from '../services/instructor-report.service';

// POST /api/reports/instructor — student reports an instructor
export const handleReportInstructor = async (req: Request, res: Response) => {
    try {
        const studentId = req.userId;
        const { instructorId, reason, description, mentorshipId } = req.body;

        if (!studentId) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        if (!instructorId || !reason) {
            return res.status(400).json({ status: 'error', message: 'Instructor ID and reason are required' });
        }

        const result = await reportInstructor(studentId, instructorId, reason, description, mentorshipId);

        if (!result.success) {
            return res.status(400).json({ status: 'error', message: result.message });
        }

        res.status(201).json({
            status: 'success',
            message: result.message,
            report: result.report
        });
    } catch (error) {
        console.error('Report instructor controller error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to submit report' });
    }
};

// GET /api/reports/instructor — admin gets all instructor reports
export const handleGetAllInstructorReports = async (req: Request, res: Response) => {
    try {
        const { status } = req.query;
        const result = await getAllInstructorReports(status as string);

        if (!result.success) {
            return res.status(500).json({ status: 'error', message: result.message });
        }

        res.status(200).json({
            status: 'success',
            reports: result.reports
        });
    } catch (error) {
        console.error('Get all reports controller error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch reports' });
    }
};

// PATCH /api/reports/instructor/:reportId — admin updates report status
export const handleUpdateReportStatus = async (req: Request, res: Response) => {
    try {
        const { reportId } = req.params;
        const { status, adminNotes } = req.body;

        if (!status || !['pending', 'reviewing', 'resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ status: 'error', message: 'Invalid status' });
        }

        const result = await updateReportStatus(Array.isArray(reportId) ? reportId[0] : reportId, status, adminNotes);

        if (!result.success) {
            return res.status(400).json({ status: 'error', message: result.message });
        }

        res.status(200).json({
            status: 'success',
            message: result.message,
            report: result.report
        });
    } catch (error) {
        console.error('Update report status controller error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to update report status' });
    }
};

// GET /api/reports/instructor/my-reports — student gets their own reports
export const handleGetStudentReports = async (req: Request, res: Response) => {
    try {
        const studentId = req.userId;

        if (!studentId) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const result = await getStudentReports(studentId);

        if (!result.success) {
            return res.status(500).json({ status: 'error', message: result.message });
        }

        res.status(200).json({
            status: 'success',
            reports: result.reports
        });
    } catch (error) {
        console.error('Get student reports controller error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch your reports' });
    }
};

// GET /api/reports/instructor/instructor-reports — instructor gets reports against them
export const handleGetInstructorReports = async (req: Request, res: Response) => {
    try {
        const instructorId = req.userId;

        if (!instructorId) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const result = await getInstructorReports(instructorId);

        if (!result.success) {
            return res.status(500).json({ status: 'error', message: result.message });
        }

        res.status(200).json({
            status: 'success',
            reports: result.reports
        });
    } catch (error) {
        console.error('Get instructor reports controller error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch reports' });
    }
};