import { Router } from "express";
import {
    handleResolveChat,
    handleListInstructorChats,
    handleListStudentChats,
    handleGetMessages,
    handleGetMessageById,
    handleEditMessage,
    handleDeleteMessage,
    handleSendMessage,
    handleUploadAttachment,
} from "../controllers/chat.controller";
import { ProtectMiddleWare } from "../middleware/protect-route";

const chatRouter: Router = Router();

// Resolve a conversation for a specific mentorship (instructor or student)
chatRouter.get("/mentorship/:mentorshipId", ProtectMiddleWare, handleResolveChat);

// Conversation lists
chatRouter.get("/instructor", ProtectMiddleWare, handleListInstructorChats);
chatRouter.get("/student", ProtectMiddleWare, handleListStudentChats);

// Messages for a conversation
chatRouter.get("/:chatId/messages", ProtectMiddleWare, handleGetMessages);

// A single message in a conversation (includes base64 attachmentData)
chatRouter.get("/:chatId/messages/:messageId", ProtectMiddleWare, handleGetMessageById);

// Edit a message (PATCH) or delete a message (DELETE ?mode=me|general)
chatRouter.patch("/:chatId/messages/:messageId", ProtectMiddleWare, handleEditMessage);
chatRouter.delete("/:chatId/messages/:messageId", ProtectMiddleWare, handleDeleteMessage);

// Save a base64 data URL (image or voice note), then reference the returned URL when sending a message
chatRouter.post("/:chatId/attachments", ProtectMiddleWare, handleUploadAttachment);

// Send a message
chatRouter.post("/:chatId/messages", ProtectMiddleWare, handleSendMessage);

export default chatRouter;