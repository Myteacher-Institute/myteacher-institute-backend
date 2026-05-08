import { Router } from "express";
import { handleInstructorLogin, handleApplyAsInstructor, handleVerifyInstructor, handleRejectInstructor, handleGetAllInstructors, handleSendResetPasswordCode, handleResetPassword, handleResendResetPassword, handleGetInstructorById, handleDeleteInstructor, handleUpdateInstructor } from "../controllers/instructor.controller";
import { ProtectMiddleWare } from "../middleware/protect-route";
import { isAdmin } from "../middleware/is-admin";

const router: Router = Router();

router.post("/login", handleInstructorLogin);
router.post("/apply", handleApplyAsInstructor);
router.post("/send-reset-code", handleSendResetPasswordCode);
router.post("/resend-reset-code", handleResendResetPassword);
router.post("/reset-password", handleResetPassword);
router.patch("/verify/:instructorId", ProtectMiddleWare, isAdmin, handleVerifyInstructor);
router.delete("/reject/:instructorId", ProtectMiddleWare, isAdmin, handleRejectInstructor);
router.get("/all", ProtectMiddleWare, isAdmin, handleGetAllInstructors);
router.get("/:instructorId", ProtectMiddleWare, isAdmin, handleGetInstructorById);
router.delete("/:instructorId", ProtectMiddleWare, isAdmin, handleDeleteInstructor);
router.put("/:instructorId", ProtectMiddleWare, isAdmin, handleUpdateInstructor);

export default router;
