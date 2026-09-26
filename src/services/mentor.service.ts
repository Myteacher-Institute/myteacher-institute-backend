import { Instructor } from "../models/instructor.model";
import User from "../models/user.model";
import MentorshipRequest from "../models/mentorship-request.model";
import Transaction from '../models/transaction.model';
import CompanyMoney from '../models/company-money.model';
import { BecomeMentorReqBody, RequestMentorshipReqBody } from "../types";
import { validateWhatsAppNumber, getWhatsAppGroupLinkInfo } from "./whatsapp.service";
import {
    sendMentorshipRequestEmailToInstructor,
    sendMentorshipRequestConfirmationToStudent,
    sendMentorshipAcceptedEmailToStudent,
    sendMentorshipRejectedEmailToStudent,
    sendMentorshipPaymentConfirmedEmail,
} from "./email.service";
import { createNotification } from "./notification.service";
import { emitToUser } from "../config/socket";
import { createPaymentLink } from "./flutterwave.services";
import { cacheDelPattern } from "../config/redis";

// ============ Duration Helpers ============
/**
 * Parse a human-readable programDuration string (e.g. "4 weeks", "2 months",
 * "1 week 3 days") and return the number of days it represents.
 * Returns 0 when the string cannot be parsed.
 */
const parseProgramDuration = (duration: string): number => {
    const lower = duration.toLowerCase().trim();
    const parts = lower.split(/\s+/);
    let totalDays = 0;

    for (let i = 0; i < parts.length; i++) {
        const num = parseInt(parts[i], 10);
        if (isNaN(num)) continue;

        const unit = parts[i + 1] ?? '';
        if (unit.startsWith('day'))    { totalDays += num; i++; }
        else if (unit.startsWith('week'))  { totalDays += num * 7; i++; }
        else if (unit.startsWith('month')) { totalDays += num * 30; i++; }
        else if (unit.startsWith('year'))  { totalDays += num * 365; i++; }
    }

    return totalDays;
};

// ============ Instructor: Become a Mentor ============
export const becomeMentor = async (instructorId: string, payload: BecomeMentorReqBody) => {
    try {
        if (typeof payload.isMentor !== 'boolean') {
            return { success: false, message: 'isMentor flag is required' };
        }

        const instructor = await Instructor.findById(instructorId);
        if (!instructor) {
            return { success: false, message: 'Instructor not found' };
        }

        if (payload.isMentor) {
            // WhatsApp number is mandatory when activating mentorship
            if (!payload.whatsappNumber) {
                return { success: false, message: 'WhatsApp number is required to activate mentorship' };
            }
            if (!payload.mentorshipPrice || payload.mentorshipPrice <= 0) {
                return { success: false, message: 'A valid mentorship price per session is required' };
            }

            const validation = await validateWhatsAppNumber(payload.whatsappNumber);
            if (!validation.valid) {
                return { success: false, message: validation.message || 'Invalid WhatsApp number' };
            }

            instructor.whatsappNumber = validation.normalizedNumber!;
            instructor.mentorshipPrice = payload.mentorshipPrice;
            if (payload.mentorshipBio !== undefined) {
                instructor.mentorshipBio = payload.mentorshipBio;
            }
            instructor.isMentor = true;
            await instructor.save();

            // Instructor status + public mentors list changed
            await cacheDelPattern(`mentor:${instructorId}:*`);
            await cacheDelPattern('mentors:*');

            try {
                await createNotification({
                    recipientId: instructor._id.toString(),
                    recipientType: 'instructor',
                    title: 'Mentorship Activated',
                    message: 'Your mentorship account is now active. Students can discover and request you as their mentor.',
                    type: 'success',
                    relatedId: instructor._id.toString(),
                    relatedType: 'instructor',
                });
            } catch (notifyError) {
                console.error('Failed to create mentorship activation notification:', notifyError);
            }

            return {
                success: true,
                message: validation.checked
                    ? 'Mentorship activated successfully. Your WhatsApp number has been verified.'
                    : 'Mentorship activated successfully.',
                instructor,
            };
        }

        // Deactivate mentorship
        instructor.isMentor = false;
        await instructor.save();

        await cacheDelPattern(`mentor:${instructorId}:*`);
        await cacheDelPattern('mentors:*');

        return {
            success: true,
            message: 'Mentorship deactivated successfully.',
            instructor,
        };
    } catch (error) {
        console.error('Become mentor error --->', error);
        return { success: false, message: 'Failed to update mentorship status' };
    }
};

export const getMentorStatus = async (instructorId: string) => {
    try {
        const instructor = await Instructor.findById(instructorId).select(
            'name email profilePicture specialization bio expertise mentorshipBio whatsappNumber mentorshipPrice isMentor'
        );
        if (!instructor) {
            return { success: false, message: 'Instructor not found' };
        }
        return {
            success: true,
            isMentor: instructor.isMentor ?? false,
            mentorProfile: {
                name: instructor.name,
                email: instructor.email,
                profilePicture: instructor.profilePicture,
                specialization: instructor.specialization,
                mentorshipBio: instructor.mentorshipBio,
                whatsappNumber: instructor.whatsappNumber,
                mentorshipPrice: instructor.mentorshipPrice,
            },
        };
    } catch (error) {
        console.error('Get mentor status error --->', error);
        return { success: false, message: 'Failed to fetch mentorship status' };
    }
};

// ============ Public: List All Mentors ============
export const getAllMentors = async (limit?: number) => {
    try {
        const mentors = await Instructor.find({ isMentor: true })
            .select('name profilePicture specialization bio mentorshipBio mentorshipPrice expertise')
            .sort({ createdAt: 1 })
            .limit(limit && limit > 0 ? limit : 0)
            .lean();

        return {
            success: true,
            mentors,
            total: mentors.length,
        };
    } catch (error) {
        console.error('Get all mentors error --->', error);
        return { success: false, mentors: [], total: 0 };
    }
};

// ============ Student: Request a Mentor ============
const ALLOWED_CATEGORIES = [
    'Web Development', 'Data Science', 'UI/UX Design', 'Mobile Development',
    'Cybersecurity', 'Cloud Computing', 'Digital Marketing', 'Product Management'
];
const ALLOWED_GOALS = [
    'Career Change', 'Skill Enhancement', 'Project Guidance', 'Interview Preparation'
];

export const requestMentorship = async (studentId: string, payload: RequestMentorshipReqBody) => {
    try {
        const { instructorId, skillCategory, learningGoal, skillLevel, mentorshipType } = payload;

        if (!instructorId || !skillCategory || !learningGoal || !skillLevel || !mentorshipType) {
            return { success: false, message: 'Mentor, skill category, learning goal, skill level and mentorship type are required' };
        }

        if (!ALLOWED_GOALS.includes(learningGoal)) {
            return { success: false, message: 'Invalid learning goal selected' };
        }

        // The chosen mentor must be an active mentor
        const mentor = await Instructor.findOne({ _id: instructorId, isMentor: true });
        if (!mentor) {
            return { success: false, message: 'The selected mentor is not available for mentorship' };
        }

        // Student must exist
        const student = await User.findById(studentId);
        if (!student) {
            return { success: false, message: 'Student not found' };
        }

        const mentorshipRequest = await MentorshipRequest.create({
            studentId,
            instructorId: mentor._id,
            skillCategory,
            learningGoal,
            skillLevel,
            mentorshipType,
            budgetRange: payload.budgetRange,
            availability: payload.availability,
            additionalNotes: payload.additionalNotes,
            selectedMentor: mentor._id,
            status: 'pending',
        });

        // New request — invalidate the instructor's requests list and the student's list
        await cacheDelPattern(`mentor:${mentor._id.toString()}:*`);
        await cacheDelPattern(`mentor:student:${studentId}:*`);

        // Email the instructor with detailed request info + notify
        sendMentorshipRequestEmailToInstructor({
            instructorEmail: mentor.email,
            instructorName: mentor.name,
            studentName: student.name,
            studentEmail: student.email,
            skillCategory,
            learningGoal,
            skillLevel,
            mentorshipType,
            budgetRange: payload.budgetRange,
            availability: payload.availability,
            additionalNotes: payload.additionalNotes,
        }).catch(err => console.error('Failed to send instructor mentorship request email:', err));

        createNotification({
            recipientId: mentor._id.toString(),
            recipientType: 'instructor',
            title: 'New Mentorship Request',
            message: `${student.name} requested you as their mentor for ${skillCategory}. Review the request in your dashboard.`,
            type: 'info',
            relatedId: (mentorshipRequest as any)._id.toString(),
            relatedType: 'mentorship-request',
        }).catch(err => console.error('Failed to create instructor mentorship notification:', err));

        // Confirmation email + notification to the student
        sendMentorshipRequestConfirmationToStudent({
            studentEmail: student.email,
            studentName: student.name,
            mentorName: mentor.name,
            skillCategory,
        }).catch(err => console.error('Failed to send student mentorship confirmation email:', err));

        createNotification({
            recipientId: studentId,
            recipientType: 'user',
            title: 'Mentorship Request Sent',
            message: `Your mentorship request was sent to ${mentor.name}. We will notify you when they respond.`,
            type: 'info',
            relatedId: (mentorshipRequest as any)._id.toString(),
            relatedType: 'mentorship-request',
        }).catch(err => console.error('Failed to create student mentorship notification:', err));

        return {
            success: true,
            message: `Your mentorship request was sent to ${mentor.name}`,
            request: mentorshipRequest,
        };
    } catch (error) {
        console.error('Request mentorship error --->', error);
        return { success: false, message: 'Failed to submit mentorship request' };
    }
};

// ============ Instructor: Incoming Requests ============
export const getInstructorMentorRequests = async (instructorId: string) => {
    try {
        const requests = await MentorshipRequest.find({ instructorId, status: { $in: ['pending', 'accepted'] } })
            .populate('studentId', 'name email profilePicture')
            .sort({ createdAt: -1 })
            .lean();

        return { success: true, requests };
    } catch (error) {
        console.error('Get instructor mentor requests error --->', error);
        return { success: false, requests: [] };
    }
};

// ============ Instructor: Accept / Reject Request ============
export const acceptMentorshipRequest = async (
    instructorId: string,
    requestId: string,
    payload?: {
        availableTime?: string;
        programDuration?: string;
        groupChatLink?: string;
        actualPrice?: number;
        availableStartTime?: string;
        availableEndTime?: string;
    },
) => {
    try {
        const request = await MentorshipRequest.findById(requestId);
        if (!request) {
            return { success: false, message: 'Mentorship request not found' };
        }

        if (request.instructorId.toString() !== instructorId) {
            return { success: false, message: 'You can only respond to your own mentorship requests' };
        }

        if (request.status !== 'pending') {
            return { success: false, message: `This request has already been ${request.status}` };
        }

        const availableTime = payload?.availableTime?.trim();
        const programDuration = payload?.programDuration?.trim();
        const groupChatLink = payload?.groupChatLink?.trim();
        const actualPrice = payload?.actualPrice;
        const availableStartTime = payload?.availableStartTime?.trim();
        const availableEndTime = payload?.availableEndTime?.trim();

        if (!availableTime) {
            return { success: false, message: 'Available time is required when accepting a mentorship request' };
        }
        if (!programDuration) {
            return { success: false, message: 'Program duration is required when accepting a mentorship request' };
        }

        // The schedule pages rely on a machine-readable daily window. It is
        // optional (falls back to the free-text display only), but when either
        // bound is provided both must be valid "HH:mm" values.
        const isValidHHMM = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
        if (availableStartTime || availableEndTime) {
            if (!isValidHHMM(availableStartTime ?? '') || !isValidHHMM(availableEndTime ?? '')) {
                return { success: false, message: 'Availability window times must be valid HH:MM start and end times' };
            }
            if (availableStartTime === availableEndTime) {
                return { success: false, message: 'Availability start and end times must be different' };
            }
        }

        // Group mentorships must include a valid WhatsApp group link the student can join
        if (request.mentorshipType === 'Group') {
            const groupInfo = getWhatsAppGroupLinkInfo(groupChatLink ?? '');
            if (!groupInfo.valid || !groupInfo.normalizedLink) {
                return { success: false, message: groupInfo.message || 'A valid WhatsApp group link is required for group mentorships' };
            }
        }

        const instructor = await Instructor.findById(instructorId);
        const student = await User.findById(request.studentId);
        if (!instructor || !student) {
            return { success: false, message: 'Mentor or student not found' };
        }

        if (!instructor.isMentor || !instructor.whatsappNumber) {
            return { success: false, message: 'Activate your mentorship account before accepting requests' };
        }

        // Effective price: instructor can set a custom price per program, otherwise the default
        const effectivePrice = (typeof actualPrice === 'number' && actualPrice > 0)
            ? Math.round(actualPrice)
            : (instructor.mentorshipPrice ?? 0);
        if (effectivePrice <= 0) {
            return { success: false, message: 'A valid mentorship price is required' };
        }

        request.status = 'accepted';
        request.availableTime = availableTime;
        request.programDuration = programDuration;
        request.groupChatLink = request.mentorshipType === 'Group' ? groupChatLink : undefined;
        request.actualPrice = (typeof actualPrice === 'number' && actualPrice > 0) ? Math.round(actualPrice) : undefined;

        // Compute the end date from the human-readable duration string
        const days = parseProgramDuration(programDuration);
        if (days > 0) {
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + days);
            request.programEndDate = endDate;
        }

        await request.save();

        // Status changed — invalidate both parties' cached lists
        await cacheDelPattern(`mentor:${instructorId}:*`);
        await cacheDelPattern(`mentor:student:${request.studentId.toString()}:*`);

        // Create the Flutterwave payment link up front so it goes out in the
        // acceptance email — the student pays through this unique link.
        const transactionReference = generateMentorshipReference(instructorId, requestId);
        let paymentLink = '';
        try {
            const paymentResponse = await createPaymentLink({
                amount: effectivePrice,
                currency: 'NGN',
                tx_ref: transactionReference,
                redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`,
                customer: {
                    email: student.email,
                    name: student.name,
                },
                customizations: {
                    title: `Mentorship with ${instructor.name}`,
                    description: `${request.skillCategory} mentorship — ${request.mentorshipType}`,
                },
            });
            paymentLink = paymentResponse.data.link;
        } catch (paymentError) {
            console.error('Failed to create mentorship payment link:', paymentError);
            return { success: false, message: 'Could not initialize payment. Please try again.' };
        }

        request.paymentReference = transactionReference;
        request.paymentStatus = 'pending';
        await request.save();

        await Transaction.create({
            userId: request.studentId,
            purpose: 'mentorship',
            amount: effectivePrice,
            currency: 'NGN',
            status: 'pending',
            transactionReference,
            paymentMethod: 'flutterwave',
        });

        // Notify + email the student that the mentor accepted, with schedule + payment button
        sendMentorshipAcceptedEmailToStudent({
            studentEmail: student.email,
            studentName: student.name,
            mentorName: instructor.name,
            amount: effectivePrice,
            currency: 'NGN',
            paymentLink,
            availableTime,
            programDuration,
        }).catch(err => console.error('Failed to send mentorship acceptance email:', err));

        await createNotification({
            recipientId: request.studentId.toString(),
            recipientType: 'user',
            title: 'Mentorship Request Accepted',
            message: `${instructor.name} accepted your mentorship request! Available time: ${availableTime} • Duration: ${programDuration}. Complete your payment of NGN ${effectivePrice} to activate your mentorship.`,
            type: 'success',
            relatedId: requestId,
            relatedType: 'mentorship-payment',
        });

        emitToUser(request.studentId.toString(), 'mentorship:accepted', {
            requestId,
            mentorName: instructor.name,
            amount: instructor.mentorshipPrice ?? 0,
            paymentLink,
            availableTime,
            programDuration,
        });

        return {
            success: true,
            message: 'Mentorship request accepted. Payment link sent to the student.',
            request,
        };
    } catch (error) {
        console.error('Accept mentorship request error --->', error);
        return { success: false, message: 'Failed to accept mentorship request' };
    }
};

export const rejectMentorshipRequest = async (instructorId: string, requestId: string) => {
    try {
        const request = await MentorshipRequest.findById(requestId);
        if (!request) {
            return { success: false, message: 'Mentorship request not found' };
        }

        if (request.instructorId.toString() !== instructorId) {
            return { success: false, message: 'You can only respond to your own mentorship requests' };
        }

        if (request.status !== 'pending') {
            return { success: false, message: `This request has already been ${request.status}` };
        }

        const instructor = await Instructor.findById(instructorId).select('name');
        const student = await User.findById(request.studentId);
        if (!instructor || !student) {
            return { success: false, message: 'Mentor or student not found' };
        }

        request.status = 'rejected';
        await request.save();

        // Status changed — invalidate both parties' cached lists
        await cacheDelPattern(`mentor:${instructorId}:*`);
        await cacheDelPattern(`mentor:student:${request.studentId.toString()}:*`);

        sendMentorshipRejectedEmailToStudent({
            studentEmail: student.email,
            studentName: student.name,
            mentorName: instructor.name,
        }).catch(err => console.error('Failed to send mentorship rejection email:', err));

        await createNotification({
            recipientId: request.studentId.toString(),
            recipientType: 'user',
            title: 'Mentorship Request Declined',
            message: `${instructor.name} is unable to accept your mentorship request at this time. Browse other available mentors.`,
            type: 'warning',
            relatedId: requestId,
            relatedType: 'mentorship-request',
        });

        emitToUser(request.studentId.toString(), 'mentorship:rejected', { requestId });

        return { success: true, message: 'Mentorship request declined.', request };
    } catch (error) {
        console.error('Reject mentorship request error --->', error);
        return { success: false, message: 'Failed to reject mentorship request' };
    }
};

// ============ Student: Renew Mentorship ============
export const renewMentorship = async (studentId: string, mentorshipId: string, newDuration: string) => {
    try {
        console.log('Starting mentorship renewal:', { studentId, mentorshipId, newDuration });

        const request = await MentorshipRequest.findById(mentorshipId).populate('instructorId');
        if (!request) {
            console.log('Mentorship request not found');
            return { success: false, message: 'Mentorship request not found' };
        }

        console.log('Found request:', { 
            status: request.status, 
            studentId: request.studentId.toString(),
            actualPrice: request.actualPrice,
            programDuration: request.programDuration,
            instructorId: request.instructorId
        });

        if (request.studentId.toString() !== studentId) {
            console.log('Unauthorized access attempt');
            return { success: false, message: 'Unauthorized: You can only renew your own mentorships' };
        }

        if (request.status !== 'ended') {
            console.log('Wrong status:', request.status);
            return { success: false, message: 'Only ended mentorships can be renewed' };
        }

        // Get the original price and duration
        const originalPrice = request.actualPrice || (request.instructorId as any)?.mentorshipPrice || 0;
        const originalDuration = request.programDuration || '1 month';

        console.log('Pricing calculation:', { originalPrice, originalDuration });

        if (originalPrice === 0) {
            console.log('Zero original price');
            return { success: false, message: 'Cannot renew mentorship with no original price' };
        }

        // Convert duration to months for pricing calculation
        const getDurationInMonths = (duration: string): number => {
            const lower = duration.toLowerCase();
            if (lower.includes('month')) {
                const months = parseInt(lower) || 1;
                return months;
            } else if (lower.includes('year')) {
                const years = parseInt(lower) || 1;
                return years * 12;
            } else if (lower.includes('week')) {
                const weeks = parseInt(lower) || 1;
                return weeks / 4; // Approximate weeks to months
            } else if (lower.includes('day')) {
                const days = parseInt(lower) || 1;
                return days / 30; // Approximate days to months
            }
            return 1; // Default to 1 month
        };

        const originalMonths = getDurationInMonths(originalDuration);
        const newDurationMonths = getDurationInMonths(newDuration);

        // Calculate monthly rate from original payment
        const monthlyRate = originalPrice / originalMonths;

        // Calculate new price based on duration
        const calculatedPrice = Math.round(monthlyRate * newDurationMonths);

        // Apply 10% discount
        const discountedPrice = Math.round(calculatedPrice * 0.9);

        console.log('Price breakdown:', { 
            originalMonths, 
            newDurationMonths, 
            monthlyRate, 
            calculatedPrice, 
            discountedPrice 
        });

        // Calculate new end date based on duration (convert months to days)
        const newDurationDays = Math.round(newDurationMonths * 30);
        const newEndDate = new Date();
        newEndDate.setDate(newEndDate.getDate() + newDurationDays);

        // Get student information for payment
        const student = await User.findById(studentId);
        if (!student) {
            return { success: false, message: 'Student not found' };
        }

        // Generate transaction reference
        const transactionReference = `MYT-MENTOR-RENEW-${studentId}-${mentorshipId}-${Date.now()}`;

        console.log('Creating payment link:', {
            discountedPrice,
            transactionReference,
            studentEmail: student.email,
            studentName: student.name
        });

        // Create payment link with discounted price
        const paymentResult = await createPaymentLink({
            amount: discountedPrice,
            currency: 'NGN',
            tx_ref: transactionReference,
            redirect_url: `${process.env.FRONTEND_URL}/student/mentorship?payment=success`,
            customer: {
                email: student.email,
                name: student.name
            },
            customizations: {
                title: 'Mentorship Renewal',
                description: `Renew mentorship with ${(request.instructorId as any)?.name || 'your mentor'}`
            }
        });

        console.log('Payment link result:', paymentResult);

        if (paymentResult.status !== 'success') {
            console.log('Payment link creation failed');
            return { success: false, message: 'Failed to create payment link' };
        }

        // Create transaction record for renewal payment
        await Transaction.create({
            userId: studentId,
            purpose: 'mentorship',
            amount: discountedPrice,
            currency: 'NGN',
            status: 'pending',
            transactionReference,
            paymentMethod: 'flutterwave',
        });

        // Update the request with renewal info and temporary payment reference
        // (will be fully updated after payment success)
        request.renewalInfo = {
            originalPrice: calculatedPrice, // Store the calculated price before discount
            discountedPrice,
            newDuration,
            newEndDate,
            paymentReference: transactionReference
        };
        // Temporarily set paymentReference so payment verification can find this request
        request.paymentReference = transactionReference;
        await request.save();

        return {
            success: true,
            message: 'Mentorship renewal payment initiated',
            paymentLink: paymentResult.data?.link || '',
            transactionReference: transactionReference,
            discountedPrice,
            originalPrice: calculatedPrice,
            monthlyRate: Math.round(monthlyRate)
        };
    } catch (error) {
        console.error('Renew mentorship error:', error);
        return { success: false, message: 'Failed to renew mentorship' };
    }
};

// ============ Student: Delete/End Mentorship ============
export const deleteMentorship = async (studentId: string, mentorshipId: string) => {
    try {
        const request = await MentorshipRequest.findById(mentorshipId);
        if (!request) {
            return { success: false, message: 'Mentorship request not found' };
        }

        if (request.studentId.toString() !== studentId) {
            return { success: false, message: 'Unauthorized: You can only delete your own mentorships' };
        }

        // Update status to ended/cancelled
        request.status = 'ended';
        await request.save();

        // Notify instructor
        await createNotification({
            recipientId: request.instructorId.toString(),
            recipientType: 'instructor',
            title: 'Mentorship Ended',
            message: 'A student has ended their mentorship with you',
            type: 'info',
            relatedId: request._id.toString(),
            relatedType: 'mentorship'
        });

        // Emit real-time notification
        emitToUser(request.instructorId.toString(), 'mentorship:ended', {
            mentorshipId: request._id
        });

        return {
            success: true,
            message: 'Mentorship ended successfully'
        };
    } catch (error) {
        console.error('Delete mentorship error:', error);
        return { success: false, message: 'Failed to end mentorship' };
    }
};

// ============ Student: Re-initiate Payment for an Accepted Request ============
export const createMentorshipPayment = async (studentId: string, requestId: string) => {
    try {
        const request = await MentorshipRequest.findById(requestId);
        if (!request) {
            return { success: false, message: 'Mentorship request not found' };
        }

        if (request.studentId.toString() !== studentId) {
            return { success: false, message: 'You can only pay for your own mentorship requests' };
        }

        if (request.status !== 'accepted') {
            return { success: false, message: `This mentorship is ${request.status} — no payment is due` };
        }

        if (request.paymentStatus === 'successful') {
            return { success: false, message: 'This mentorship has already been paid for' };
        }

        const instructor = await Instructor.findById(request.instructorId);
        const student = await User.findById(studentId);
        if (!instructor || !student) {
            return { success: false, message: 'Mentor or student not found' };
        }

        if (!instructor.isMentor || !instructor.whatsappNumber || !instructor.mentorshipPrice || instructor.mentorshipPrice <= 0) {
            return { success: false, message: 'This mentor is no longer accepting payments' };
        }

        // Fresh reference each time so a lost/expired email link can be replaced
        const transactionReference = generateMentorshipReference(instructor._id.toString(), requestId);

        let paymentLink = '';
        try {
            const paymentResponse = await createPaymentLink({
                amount: instructor.mentorshipPrice,
                currency: 'NGN',
                tx_ref: transactionReference,
                redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`,
                customer: {
                    email: student.email,
                    name: student.name,
                },
                customizations: {
                    title: `Mentorship with ${instructor.name}`,
                    description: `${request.skillCategory} mentorship — ${request.mentorshipType}`,
                },
            });
            paymentLink = paymentResponse.data.link;
        } catch (paymentError) {
            console.error('Failed to re-create mentorship payment link:', paymentError);
            return { success: false, message: 'Could not initialize payment. Please try again.' };
        }

        // Cancel the previous pending transaction tied to the old reference
        const previousReference = request.paymentReference;
        if (previousReference && previousReference !== transactionReference) {
            await Transaction.updateMany(
                { transactionReference: previousReference, status: 'pending' },
                { $set: { status: 'cancelled' } },
            );
        }

        request.paymentReference = transactionReference;
        request.paymentStatus = 'pending';
        await request.save();

        // Reference changed on the accepted request — refresh the student's list
        await cacheDelPattern(`mentor:student:${studentId}:*`);

        await Transaction.create({
            userId: studentId,
            purpose: 'mentorship',
            amount: instructor.mentorshipPrice,
            currency: 'NGN',
            status: 'pending',
            transactionReference,
            paymentMethod: 'flutterwave',
        });

        return { success: true, message: 'Payment link generated successfully', paymentLink, transactionReference };
    } catch (error) {
        console.error('Create mentorship payment error --->', error);
        return { success: false, message: 'Failed to initialize mentorship payment' };
    }
};

// ============ Student: My Mentorships (active + pending) ============
export const getStudentMentorships = async (studentId: string) => {
    try {
        // Auto-mark any expired programs as "ended" before fetching
        const now = new Date();
        const expiredResult = await MentorshipRequest.updateMany(
            {
                studentId,
                status: { $in: ['paid', 'active'] },
                programEndDate: { $lte: now },
            },
            { $set: { status: 'ended' } },
        );
        if (expiredResult.modifiedCount > 0) {
            console.log(`Marked ${expiredResult.modifiedCount} expired mentorship(s) as ended for student ${studentId}`);
        }

        // Include 'ended' so the student can see past programs and renew them
        const activeRequests = await MentorshipRequest.find({ studentId, status: { $in: ['paid', 'active', 'ended'] } })
            .populate('instructorId', 'name profilePicture specialization mentorshipBio whatsappNumber mentorshipPrice')
            .sort({ createdAt: -1 })
            .lean();

        const pendingRequests = await MentorshipRequest.find({ studentId, status: { $in: ['pending', 'accepted'] } })
            .populate('instructorId', 'name profilePicture specialization mentorshipPrice')
            .sort({ createdAt: -1 })
            .lean();

        const mentorships = activeRequests.map((req: any) => {
            const mentor = req.instructorId ?? {};
            return {
                requestId: req._id.toString(),
                status: req.status,
                skillCategory: req.skillCategory,
                mentorshipType: req.mentorshipType,
                programDuration: req.programDuration,
                programEndDate: req.programEndDate,
                originalDuration: req.programDuration, // For renewal calculations
                mentor: {
                    _id: mentor._id?.toString() ?? '',
                    name: mentor.name ?? '',
                    profilePicture: mentor.profilePicture ?? '',
                    specialization: mentor.specialization ?? '',
                    mentorshipBio: mentor.mentorshipBio,
                    whatsappNumber: mentor.whatsappNumber,
                    whatsappLink: mentor.whatsappNumber ? `https://wa.me/${mentor.whatsappNumber.replace('+', '')}` : undefined,
                    mentorshipPrice: mentor.mentorshipPrice,
                },
                amountPaid: req.amountPaid,
                createdAt: req.createdAt,
            };
        });

        return { success: true, mentorships, pendingRequests };
    } catch (error) {
        console.error('Get student mentorships error --->', error);
        return { success: false, mentorships: [], pendingRequests: [] };
    }
};

/**
 * Generate a unique mentorship payment reference.
 * Format: MYT-MENTOR-<userId>-<requestId>-<timestamp>-<random>
 * The MENTOR marker lets the payment callback distinguish mentorship
 * payments from course purchases.
 */
export const generateMentorshipReference = (instructorId: string, requestId: string): string => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `MYT-MENTOR-${instructorId}-${requestId}-${timestamp}-${randomStr}`;
};

/**
 * Complete a successful mentorship payment:
 * - mark the mentorship request paid/active
 * - pay the instructor 70% into moneyMade
 * - record the company's 30% share
 * - notify/email both parties (student gets WhatsApp chat access)
 */
export const completeSuccessfulMentorship = async (transaction: any): Promise<void> => {
    transaction.status = 'successful';
    await transaction.save();

    const request = await MentorshipRequest.findOne({ paymentReference: transaction.transactionReference });
    if (!request) {
        console.error(`Mentorship request not found for reference ${transaction.transactionReference}`);
        return;
    }

    // Check if this is a renewal payment
    const isRenewal = transaction.transactionReference?.includes('MENTOR-RENEW');

    if (isRenewal && request.renewalInfo) {
        // Handle renewal completion
        request.status = 'active';
        request.paymentStatus = 'successful';
        request.amountPaid = transaction.amount;
        request.programDuration = request.renewalInfo.newDuration;
        request.programEndDate = request.renewalInfo.newEndDate;
        
        // Clear renewal info after successful payment
        request.renewalInfo = undefined;
        await request.save();

        console.log('Mentorship renewal completed successfully');
    } else {
        // Handle initial mentorship payment
        request.status = 'active';
        request.paymentStatus = 'successful';
        request.amountPaid = transaction.amount;
        await request.save();
    }

    // Payment complete — refresh the student's list and drop it from the instructor's pending requests
    await cacheDelPattern(`mentor:student:${transaction.userId.toString()}:*`);
    await cacheDelPattern(`mentor:${request.instructorId.toString()}:requests`);

    const instructor = await Instructor.findById(request.instructorId);
    const student = await User.findById(request.studentId);

    // Revenue split — 70/30 (instructor/company) by default, or
    // 50/30/20 (instructor/company/affiliate) when the sale was referred.
    let instructorShare = 0;
    try {
        const hasAffiliate = transaction.affiliateId && transaction.affiliateType;
        let affiliateShare = 0;

        if (hasAffiliate) {
            const affiliateOwnsMentorship =
                transaction.affiliateType === 'instructor' &&
                request.instructorId.toString() === transaction.affiliateId.toString();
            const affiliateIsBuyer =
                transaction.affiliateType === 'user' &&
                transaction.affiliateId.toString() === transaction.userId.toString();

            if (!affiliateOwnsMentorship && !affiliateIsBuyer) {
                affiliateShare = transaction.amount * 0.2;
                instructorShare = transaction.amount * 0.5;

                if (transaction.affiliateType === 'instructor') {
                    await Instructor.findByIdAndUpdate(transaction.affiliateId, {
                        $inc: { affiliate_money: affiliateShare }
                    });
                } else {
                    await User.findByIdAndUpdate(transaction.affiliateId, {
                        $inc: { affiliate_money: affiliateShare }
                    });
                }
            }
        }

        if (instructorShare === 0) {
            instructorShare = transaction.amount * 0.7;
        }

        if (instructor) {
            await Instructor.findByIdAndUpdate(instructor._id, {
                $inc: { moneyMade: instructorShare }
            });
        }

        // Company share — 30% of every mentorship sale is recorded
        const companyShare = transaction.amount * 0.3;
        await CompanyMoney.create({
            transactionReference: transaction.transactionReference,
            userId: transaction.userId,
            amount: transaction.amount,
            companyShare,
        });
    } catch (splitError) {
        console.error('Mentorship revenue split error:', splitError);
    }

    if (student && instructor) {
        // Notify + email the student — mentorship is live, WhatsApp unlocked
        sendMentorshipPaymentConfirmedEmail({
            studentEmail: student.email,
            studentName: student.name,
            mentorName: instructor.name,
            whatsappNumber: instructor.whatsappNumber,
            amount: transaction.amount,
            currency: transaction.currency,
            transactionReference: transaction.transactionReference,
        }).catch(err => console.error('Failed to send mentorship payment email:', err));

        await createNotification({
            recipientId: student._id.toString(),
            recipientType: 'user',
            title: 'Mentorship Activated',
            message: `Payment confirmed! Your mentorship with ${instructor.name} is now active. Chat with them on WhatsApp anytime.`,
            type: 'success',
            relatedId: (request as any)._id.toString(),
            relatedType: 'mentorship-request',
        });

        emitToUser(student._id.toString(), 'mentorship:activated', {
            requestId: (request as any)._id.toString(),
            mentorName: instructor.name,
            whatsappNumber: instructor.whatsappNumber,
        });

        // Notify the instructor of the completed payment
        await createNotification({
            recipientId: instructor._id.toString(),
            recipientType: 'instructor',
            title: 'Mentorship Payment Received',
            message: `${student.name} completed payment for their mentorship. NGN ${(transaction.amount * 0.7).toLocaleString()} (70%) has been added to your earnings.`,
            type: 'success',
            relatedId: (request as any)._id.toString(),
            relatedType: 'mentorship-request',
        });
    }
};
