import BugReport from "../models/bug-report.model";

export const reportBug = async (userId: string, userType: string, bugData: any) => {
    try {
        const bugReport = await BugReport.create({
            userId,
            userType,
            title: bugData.title,
            description: bugData.description,
            priority: bugData.priority || "medium",
            screenshots: bugData.screenshots || []
        });

        return { success: true, data: bugReport };
    } catch (error) {
        console.error('Error reporting bug:', error);
        return { success: false, message: 'Failed to report bug' };
    }
};
