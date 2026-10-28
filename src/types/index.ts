import { InstructorLoginReqBody, InstructorLoginResT, ApplyInstructorReqBody, ApplyInstructorResT, GetAllInstructorsResT, RejectInstructorResT, VerifyInstructorResT, GetInstructorByIdResT, DeleteInstructorResT, UpdateInstructorResT, ResetPasswordReqBody, ResetPasswordResT, SendResetPasswordCodeReqBody, SendResetPasswordCodeResT, VerifyInstructorOtpReqBody, VerifyInstructorOtpResT, ResendInstructorOtpReqBody, ResendInstructorOtpResT, IInstructor } from "./instructor.type";

import { CreatePaymentReqBody, CreatePaymentResT, VerifyPaymentResT, ITransaction } from './transaction.type';
import mongoose from "mongoose";

export interface IUser extends mongoose.Document {
    password: string;
    email: string;
    name: string;
    phone?: string;
    isEmailVerified: boolean;
    hasOnboarded: boolean;
    coursesBought: mongoose.Schema.Types.ObjectId[];
    role: "user" | "instructor" | "admin";
    isOnline?: boolean;
    lastSeen?: Date;
    socketId?: string;
    profilePicture?: string;
    hasAffiliateAccount?: boolean;
    affiliate_id?: string;
    affiliate_money?: number;
    googleId?: string;
    recommendations?: string[];
    recommendationsProvided?: boolean;
    aiTokens?: number;
    // Provided by mongoose timestamps option on the user schema
    createdAt: Date;
    updatedAt: Date;
}

import { ICourse, AddCourseReqBody, AddCourseResT, FetchCoursesByUserReqBody, FetchCoursesByUserResT, FetchAllCoursesResT, BrowseCoursesResT, EditCourseReqBody, EditCourseResT, FetchCourseByIdResT, CoursePreviewResT, PopularCourse, FetchPopularCoursesResT } from './course.type';

import { IAdmin, AddAdminReqBody, AddAdminResT, AdminLoginReqBody, AdminLoginResT, VerifyAdminOtpReqBody, VerifyAdminOtpResT, ResendAdminOtpReqBody, ResendAdminOtpResT, SendAdminResetCodeReqBody, SendAdminResetCodeResT, ResetAdminPasswordReqBody, ResetAdminPasswordResT } from './admin.type';

import { FetchInstructorStudentsResT, AppliedUser, CourseWithStudents } from './instructor-students.type';

import { FetchInstructorEarningsResT, CourseEarnings, EarningsData } from './instructor-earnings.type';

import { EditInstructorProfileReqBody, EditInstructorProfileResT, SendDeleteAccountOTPReqBody, SendDeleteAccountOTPResT, VerifyDeleteAccountOTPReqBody, DeleteInstructorAccountResT, ReportBugReqBody, ReportBugResT } from './instructor-settings.type';

import { ICompanyMoney } from './company-money.type';

import { ICourseCreationJob, CreateCourseCreationReqBody, CreateCourseCreationResT, FetchActiveCourseCreationsResT, ActiveCourseCreationJob, CourseCreationStatus, CourseCreationStage, CourseCreationPayload, CourseCreationVideoFile, CourseCreationAssetFile, CourseCreationResultVideo, CourseCreationResultAsset } from './course-creation.type';

import { BecomeMentorReqBody, BecomeMentorResT, GetMentorStatusResT, MentorListItem, GetAllMentorsResT, RequestMentorshipReqBody, RequestMentorshipResT, GetInstructorMentorRequestsResT, AcceptMentorshipReqBody, AcceptMentorRequestResT, StudentMentorshipItem, GetStudentMentorshipsResT, CreateMentorshipPaymentReqBody, CreateMentorshipPaymentResT } from './mentorship.type';

import { ICommunity, CreateCommunityReqBody, CreateCommunityResT, GetAllCommunitiesResT, GetCommunityByIdResT, JoinCommunityResT, PostContentReqBody, PostContentResT, LikePostResT, CommentPostReqBody, CommentPostResT } from './community.type';





export type {
    InstructorLoginReqBody,
    InstructorLoginResT,
    IInstructor,
    ApplyInstructorReqBody,
    ApplyInstructorResT,
    GetAllInstructorsResT,
    RejectInstructorResT,
    VerifyInstructorResT,
    GetInstructorByIdResT,
    DeleteInstructorResT,
    UpdateInstructorResT,
    ResetPasswordReqBody,
    ResetPasswordResT,
    SendResetPasswordCodeReqBody,
    SendResetPasswordCodeResT,
    VerifyInstructorOtpReqBody,
    VerifyInstructorOtpResT,
    ResendInstructorOtpReqBody,
    ResendInstructorOtpResT,
    CreatePaymentReqBody,
    CreatePaymentResT,
    VerifyPaymentResT,
    ITransaction,
    ICourse,
    AddCourseReqBody,
    AddCourseResT,
    FetchCoursesByUserReqBody,
    FetchCoursesByUserResT,
    FetchAllCoursesResT,
    BrowseCoursesResT,
    EditCourseReqBody,
    EditCourseResT,
    FetchCourseByIdResT,
    CoursePreviewResT,
    PopularCourse,
    FetchPopularCoursesResT,
    IAdmin,
    AddAdminReqBody,
    AddAdminResT,
    AdminLoginReqBody,
    AdminLoginResT,
    VerifyAdminOtpReqBody,
    VerifyAdminOtpResT,
    ResendAdminOtpReqBody,
    ResendAdminOtpResT,
    SendAdminResetCodeReqBody,
    SendAdminResetCodeResT,
    ResetAdminPasswordReqBody,
    ResetAdminPasswordResT,
    FetchInstructorStudentsResT,
    AppliedUser,
    CourseWithStudents,
    FetchInstructorEarningsResT,
    CourseEarnings,
    EarningsData,
    EditInstructorProfileReqBody,
    EditInstructorProfileResT,
    SendDeleteAccountOTPReqBody,
    SendDeleteAccountOTPResT,
    VerifyDeleteAccountOTPReqBody,
    DeleteInstructorAccountResT,
    ReportBugReqBody,
    ReportBugResT,
    ICompanyMoney,
    ICourseCreationJob,
    CreateCourseCreationReqBody,
    CreateCourseCreationResT,
    FetchActiveCourseCreationsResT,
    ActiveCourseCreationJob,
    CourseCreationStatus,
    CourseCreationStage,
    CourseCreationPayload,
    CourseCreationVideoFile,
    CourseCreationAssetFile,
    CourseCreationResultVideo,
    CourseCreationResultAsset,
    BecomeMentorReqBody,
    BecomeMentorResT,
    GetMentorStatusResT,
    MentorListItem,
    GetAllMentorsResT,
    RequestMentorshipReqBody,
    RequestMentorshipResT,
    GetInstructorMentorRequestsResT,
    AcceptMentorshipReqBody,
    AcceptMentorRequestResT,
    StudentMentorshipItem,
    GetStudentMentorshipsResT,
    CreateMentorshipPaymentReqBody,
    CreateMentorshipPaymentResT,
    ICommunity,
    CreateCommunityReqBody,
    CreateCommunityResT,
    GetAllCommunitiesResT,
    GetCommunityByIdResT,
    JoinCommunityResT,
    PostContentReqBody,
    PostContentResT,
    LikePostResT,
    CommentPostReqBody,
    CommentPostResT
};
