import { InstructorLoginReqBody, InstructorLoginResT, ApplyInstructorReqBody, ApplyInstructorResT, GetAllInstructorsResT, RejectInstructorResT, VerifyInstructorResT, GetInstructorByIdResT, DeleteInstructorResT, UpdateInstructorResT, ResetPasswordReqBody, ResetPasswordResT, SendResetPasswordCodeReqBody, SendResetPasswordCodeResT, IInstructor } from "./instructor.type";

import { CreatePaymentReqBody, CreatePaymentResT, VerifyPaymentResT, ITransaction } from './transaction.type';

import { ICourse, CreateCourseReqBody, CreateCourseResT, UpdateCourseReqBody, UpdateCourseResT, DeleteCourseResT, GetCourseByIdResT, GetAllCoursesResT, FetchAllCoursesResT } from './course.type';

import { IAdmin, AddAdminReqBody, AddAdminResT } from './admin.type';





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
    CreatePaymentReqBody,
    CreatePaymentResT,
    VerifyPaymentResT,
    ITransaction,
    ICourse,
    CreateCourseReqBody,
    CreateCourseResT,
    UpdateCourseReqBody,
    UpdateCourseResT,
    DeleteCourseResT,
    GetCourseByIdResT,
    GetAllCoursesResT,
    FetchAllCoursesResT,
    IAdmin,
    AddAdminReqBody,
    AddAdminResT
};
