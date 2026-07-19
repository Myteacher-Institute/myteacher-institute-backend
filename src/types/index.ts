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
}

import { ICourse, AddCourseReqBody, AddCourseResT, FetchCoursesByUserReqBody, FetchCoursesByUserResT, FetchAllCoursesResT, EditCourseReqBody, EditCourseResT, FetchCourseByIdResT } from './course.type';

import { IAdmin, AddAdminReqBody, AddAdminResT, AdminLoginReqBody, AdminLoginResT, VerifyAdminOtpReqBody, VerifyAdminOtpResT, ResendAdminOtpReqBody, ResendAdminOtpResT, SendAdminResetCodeReqBody, SendAdminResetCodeResT, ResetAdminPasswordReqBody, ResetAdminPasswordResT } from './admin.type';





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
    EditCourseReqBody,
    EditCourseResT,
    FetchCourseByIdResT,
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
    ResetAdminPasswordResT
};
