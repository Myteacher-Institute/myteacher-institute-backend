import mongoose from "mongoose";
import { IMentorshipRequest } from "../models/mentorship-request.model";

// ============ Become a Mentor (Instructor) ============
export interface BecomeMentorReqBody {
    isMentor: boolean;
    whatsappNumber?: string;
    mentorshipBio?: string;
    mentorshipPrice?: number;
}

export interface BecomeMentorResT {
    status: "success" | "failed";
    message: string;
    instructor?: any;
}

export interface GetMentorStatusResT {
    status: "success" | "failed";
    message?: string;
    isMentor?: boolean;
    mentorProfile?: {
        name: string;
        email: string;
        profilePicture: string;
        specialization: string;
        mentorshipBio?: string;
        whatsappNumber?: string;
        mentorshipPrice?: number;
    };
}

// ============ List Mentors ============
export interface MentorListItem {
    _id: string;
    name: string;
    profilePicture: string;
    specialization: string;
    bio?: string;
    mentorshipBio?: string;
    mentorshipPrice?: number;
    expertise?: string[];
}

export interface GetAllMentorsResT {
    status: "success" | "failed";
    message: string;
    mentors: MentorListItem[];
    total: number;
}

// ============ Request Mentorship (Student) ============
export interface RequestMentorshipReqBody {
    instructorId: string;
    skillCategory: string;
    learningGoal: string;
    skillLevel: 'Beginner' | 'Intermediate' | 'Advanced';
    mentorshipType: 'Private' | 'Group';
    budgetRange?: string;
    availability?: string;
    additionalNotes?: string;
}

export interface RequestMentorshipResT {
    status: "success" | "failed";
    message: string;
    request?: IMentorshipRequest;
}

// ============ Instructor Mentor Requests ============
export interface GetInstructorMentorRequestsResT {
    status: "success" | "failed";
    message: string;
    requests?: Array<IMentorshipRequest & { studentId: any }>;
}

export interface AcceptMentorshipReqBody {
    availableTime: string;
    programDuration: string;
}

export interface AcceptMentorRequestResT {
    status: "success" | "failed";
    message: string;
    request?: IMentorshipRequest;
}

// ============ Student Mentorships ============
export interface StudentMentorshipItem {
    requestId: string;
    status: string;
    mentor: {
        _id: string;
        name: string;
        profilePicture: string;
        specialization: string;
        mentorshipBio?: string;
        whatsappNumber?: string;
        whatsappLink?: string;
        mentorshipPrice?: number;
    };
    amountPaid?: number;
    createdAt: Date;
}

export interface GetStudentMentorshipsResT {
    status: "success" | "failed";
    message: string;
    mentorships?: StudentMentorshipItem[];
    pendingRequests?: Array<IMentorshipRequest & { instructorId: any }>;
}

// ============ Mentorship Payment ============
export interface CreateMentorshipPaymentReqBody {
    redirectUrl?: string;
}

export interface CreateMentorshipPaymentResT {
    status: "success" | "failed";
    message: string;
    paymentLink?: string;
    transactionReference?: string;
}
