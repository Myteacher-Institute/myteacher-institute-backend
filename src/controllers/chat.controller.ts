import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { resolveChatForMentorship, listInstructorChats, listStudentChats, getChatMessages, getChatMessageById, sendChatMessage, editChatMessage, deleteChatMessage, ensureChatsForInstructor } from "../services/chat.service";
import { getPusher } from "../config/pusher";
import Chat from "../models/chat.model";

// Allowed base directory for uploaded assets — must match the static /uploads mount
const ALLOWED_ASSET_DIR = path.resolve(
    process.env.ASSET_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'assets')
);

if (!fs.existsSync(ALLOWED_ASSET_DIR)) {
    fs.mkdirSync(ALLOWED_ASSET_DIR, { recursive: true });
}

const MAX_ASSET_BYTES = 10 * 1024 * 1024; // 10 MB decoded

const EXT_BY_MIME: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'audio/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/x-m4a': '.m4a',
    'audio/aac': '.aac',
};

const kindRequiresMime: Record<'image' | 'voice', (mime: string) => boolean> = {
    image: (mime) => mime.startsWith('image/'),
    voice: (mime) => mime.startsWith('audio/'),
};

/**
 * Decode a `data:<mime>;base64,<payload>` URL, validate it matches the
 * expected kind (image | voice), write it to the assets dir and return the
 * public URL clients use to render it.
 */
const saveBase64Asset = async (dataUrl: string, kind: 'image' | 'voice') => {
    if (typeof dataUrl !== 'string' || !dataUrl) {
        return { error: 'File data is required' };
    }

    const match = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
    if (!match) {
        return { error: 'Invalid file data. Expected a base64 data URL.' };
    }

    const mime = match[1].toLowerCase();
    const payload = match[2];

    if (!kindRequiresMime[kind](mime)) {
        return { error: `Invalid ${kind} file. MIME type "${mime}" is not allowed.` };
    }

    // Base64 payload is ~4 bytes of text per 3 bytes of data
    const approxBytes = Math.floor(payload.length * 3 / 4);
    if (approxBytes > MAX_ASSET_BYTES) {
        return { error: 'File is too large (max 10 MB)' };
    }

    const buffer = Buffer.from(payload, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_ASSET_BYTES) {
        return { error: 'File is too large (max 10 MB)' };
    }

    const ext = EXT_BY_MIME[mime] ?? `.${mime.split('/')[1] ?? 'bin'}`;
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const targetPath = path.join(ALLOWED_ASSET_DIR, filename);

    await fs.promises.writeFile(targetPath, buffer);

    return { url: `/uploads/assets/${filename}` };
};

// GET /api/chat/mentorship/:mentorshipId — resolve (or lazily create) the conversation for a mentorship
const handleResolveChat = async (req: Request<{ mentorshipId: string }>, res: Response) => {
    try {
        const { mentorshipId } = req.params;
        const viewerId = req.userId;
        if (!viewerId) {
            return res.status(401).json({ status: 'failed', message: 'Unauthorized' });
        }

        const chat = await resolveChatForMentorship(mentorshipId, viewerId);
        if (!chat) {
            return res.status(403).json({ status: 'failed', message: 'You are not part of this mentorship' });
        }
        return res.status(200).json({ status: 'success', chat });
    } catch (error) {
        console.error('Resolve chat error --->', (error as Error)?.message ?? error);
        res.status(500).json({ status: 'failed', message: 'Internal server error' });
    }
};

// GET /api/chat/instructor — instructor's conversations
const handleListInstructorChats = async (req: Request, res: Response) => {
    try {
        const instructorId = req.userId;
        if (!instructorId) {
            return res.status(401).json({ status: 'failed', message: 'Unauthorized' });
        }
        await ensureChatsForInstructor(instructorId);
        const chats = await listInstructorChats(instructorId);
        return res.status(200).json({ status: 'success', chats });
    } catch (error) {
        console.error('List instructor chats error --->', (error as Error)?.message ?? error);
        res.status(500).json({ status: 'failed', message: 'Internal server error' });
    }
};

// GET /api/chat/student — student's conversations
const handleListStudentChats = async (req: Request, res: Response) => {
    try {
        const studentId = req.userId;
        if (!studentId) {
            return res.status(401).json({ status: 'failed', message: 'Unauthorized' });
        }
        const chats = await listStudentChats(studentId);
        return res.status(200).json({ status: 'success', chats });
    } catch (error) {
        console.error('List student chats error --->', (error as Error)?.message ?? error);
        res.status(500).json({ status: 'failed', message: 'Internal server error' });
    }
};

// GET /api/chat/:chatId/messages — full conversation (also marks as read)
const handleGetMessages = async (req: Request<{ chatId: string }>, res: Response) => {
    try {
        const { chatId } = req.params;
        const viewerId = req.userId;
        if (!viewerId) {
            return res.status(401).json({ status: 'failed', message: 'Unauthorized' });
        }
        const result = await getChatMessages(chatId, viewerId);
        if (!result) {
            return res.status(403).json({ status: 'failed', message: 'You are not part of this conversation' });
        }
        return res.status(200).json({ status: 'success', ...result });
    } catch (error) {
        console.error('Get chat messages error --->', (error as Error)?.message ?? error);
        res.status(500).json({ status: 'failed', message: 'Internal server error' });
    }
};

// GET /api/chat/:chatId/messages/:messageId — a single message including
// base64 attachmentData (omitted from Pusher events to stay under the payload cap)
const handleGetMessageById = async (req: Request<{ chatId: string; messageId: string }>, res: Response) => {
    try {
        const { chatId, messageId } = req.params;
        const viewerId = req.userId;
        if (!viewerId) {
            return res.status(401).json({ status: 'failed', message: 'Unauthorized' });
        }
        const message = await getChatMessageById(chatId, messageId, viewerId);
        if (!message) {
            return res.status(404).json({ status: 'failed', message: 'Message not found' });
        }
        return res.status(200).json({ status: 'success', message });
    } catch (error) {
        console.error('Get chat message by id error --->', (error as Error)?.message ?? error);
        res.status(500).json({ status: 'failed', message: 'Internal server error' });
    }
};

// PATCH /api/chat/:chatId/messages/:messageId — edit a message { content }
const handleEditMessage = async (req: Request<{ chatId: string; messageId: string }>, res: Response) => {
    try {
        const { chatId, messageId } = req.params;
        const viewerId = req.userId;
        if (!viewerId) {
            return res.status(401).json({ status: 'failed', message: 'Unauthorized' });
        }

        const { content } = req.body ?? {};
        const result = await editChatMessage({ chatId, messageId, viewerId, content });
        if (!result.success) {
            return res.status(400).json({ status: 'failed', message: result.message });
        }
        return res.status(200).json({ status: 'success', message: result.data });
    } catch (error) {
        console.error('Edit chat message error --->', (error as Error)?.message ?? error);
        res.status(500).json({ status: 'failed', message: 'Internal server error' });
    }
};

// DELETE /api/chat/:chatId/messages/:messageId?mode=me|general — delete a message
const handleDeleteMessage = async (req: Request<{ chatId: string; messageId: string }>, res: Response) => {
    try {
        const { chatId, messageId } = req.params;
        const viewerId = req.userId;
        if (!viewerId) {
            return res.status(401).json({ status: 'failed', message: 'Unauthorized' });
        }

        const mode = req.query.mode === 'general' ? 'general' : 'me';
        const result = await deleteChatMessage({ chatId, messageId, viewerId, mode });
        if (!result.success) {
            return res.status(400).json({ status: 'failed', message: result.message });
        }
        return res.status(200).json({ status: 'success', ...result });
    } catch (error) {
        console.error('Delete chat message error --->', (error as Error)?.message ?? error);
        res.status(500).json({ status: 'failed', message: 'Internal server error' });
    }
};

// POST /api/chat/:chatId/messages — send a message { content?, attachmentUrl?, attachmentData?, attachmentType? }
const handleSendMessage = async (req: Request<{ chatId: string }>, res: Response) => {
    try {
        const { chatId } = req.params;
        const senderId = req.userId;
        if (!senderId) {
            return res.status(401).json({ status: 'failed', message: 'Unauthorized' });
        }

        const { content, attachmentUrl, attachmentData, attachmentType, attachmentName } = req.body ?? {};

        // Attachments (images, voice notes and any file) are sent as base64
        // data URLs. Validate and cap the decoded size — voice notes to
        // ~5 minutes / 5 MB, images to 10 MB, other files to 100 MB. Large
        // files are stored in MongoDB via GridFS (never on the filesystem).
        let dataUrl = attachmentData;
        if (dataUrl) {
            const type = attachmentType === 'voice' ? 'voice' : attachmentType === 'file' ? 'file' : 'image';
            let mimePrefix = 'image/';
            let maxBytes = 10 * 1024 * 1024;
            let label = 'Image';
            if (type === 'voice') { mimePrefix = 'audio/'; maxBytes = 5 * 1024 * 1024; label = 'Voice note'; }
            else if (type === 'file') { mimePrefix = ''; maxBytes = 100 * 1024 * 1024; label = 'File'; }

            // MIME types like "application/pdf" contain a "/" — the image/voice
            // prefixes carry theirs, but generic files must accept the whole
            // type, so the character class has to include the separator.
            const typeRegex = type === 'file'
                ? /^data:([a-zA-Z0-9.+-/]+);base64,(.+)$/
                : new RegExp(`^data:(${mimePrefix}[a-zA-Z0-9.+-]+);base64,(.+)$`);
            const match = typeRegex.exec(String(dataUrl));
            if (!match) {
                return res.status(400).json({ status: 'failed', message: type === 'file'
                    ? 'File must be a base64 data URL'
                    : `${label} must be a base64 ${mimePrefix.slice(0, -1)} data URL` });
            }
            const payload = match[2];
            const approxBytes = Math.floor(payload.length * 3 / 4);
            if (approxBytes > maxBytes) {
                return res.status(400).json({ status: 'failed', message: `${label} is too large (max ${Math.floor(maxBytes / 1024 / 1024)} MB)` });
            }
            const buffer = Buffer.from(payload, 'base64');
            if (buffer.length === 0 || buffer.length > maxBytes) {
                return res.status(400).json({ status: 'failed', message: `${label} is too large (max ${Math.floor(maxBytes / 1024 / 1024)} MB)` });
            }
        }

        // Accept attachmentData for 'image', 'voice' or 'file'; ignore unknown types.
        const finalType: 'image' | 'voice' | 'file' | undefined =
            attachmentType === 'image' || attachmentType === 'voice' || attachmentType === 'file' ? attachmentType : undefined;

        const result = await sendChatMessage({
            chatId,
            senderId,
            content: content,
            attachmentUrl: attachmentUrl,
            attachmentData: dataUrl,
            attachmentType: finalType,
            attachmentName: attachmentName,
        });

        if (!result.success) {
            return res.status(400).json({ status: 'failed', message: result.message });
        }
        return res.status(201).json({ status: 'success', message: result.data });
    } catch (error) {
        console.error('Send chat message error --->', (error as Error)?.message ?? error);
        res.status(500).json({ status: 'failed', message: 'Internal server error' });
    }
};

// POST /api/chat/:chatId/attachments — save a base64 data URL (image | voice)// Body: { dataUrl: string, kind: 'image' | 'voice' }
const handleUploadAttachment = async (req: Request<{ chatId: string }>, res: Response) => {
    try {
        const { dataUrl, kind } = req.body ?? {};
        if (kind !== 'image' && kind !== 'voice') {
            return res.status(400).json({ status: 'failed', message: 'kind must be "image" or "voice"' });
        }

        const result = await saveBase64Asset(dataUrl, kind);
        if (result.error || !result.url) {
            return res.status(400).json({ status: 'failed', message: result.error ?? 'Failed to save file' });
        }

        return res.status(201).json({
            status: 'success',
            attachment: { url: result.url, type: kind },
        });
    } catch (error) {
        console.error('Upload chat attachment error --->', (error as Error)?.message ?? error);
        res.status(500).json({ status: 'failed', message: 'Internal server error' });
    }
};

// POST /api/pusher/auth — authorizes Pusher private-channel subscriptions
// Body (form-encoded by Pusher.js): { socket_id, channel_name }
const handlePusherAuth = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ status: "failed", message: "Unauthorized" });
        }

        const { socket_id, channel_name } = req.body;
        if (!socket_id || !channel_name) {
            return res.status(400).json({ status: "failed", message: "Missing socket_id or channel_name" });
        }

        // private-user-{userId} — only the owner may subscribe
        if (channel_name.startsWith('private-user-')) {
            const channelUserId = channel_name.replace('private-user-', '');
            if (channelUserId !== userId) {
                return res.status(403).json({ status: "failed", message: "Forbidden" });
            }
        }

        // private-chat-{chatId} — only student/instructor of the chat may subscribe
        if (channel_name.startsWith('private-chat-')) {
            const chatId = channel_name.replace('private-chat-', '');
            const chat = await Chat.findById(chatId);
            if (!chat) {
                return res.status(404).json({ status: "failed", message: "Chat not found" });
            }
            const isParticipant =
                chat.studentId.toString() === userId || chat.instructorId.toString() === userId;
            if (!isParticipant) {
                return res.status(403).json({ status: "failed", message: "Forbidden" });
            }
        }

        const pusher = getPusher();
        const authResponse = pusher.authenticate(socket_id, channel_name, {
            user_id: userId,
        });

        return res.send(authResponse);
    } catch (error) {
        console.error('Pusher auth error --->', (error as Error)?.message ?? error);
        return res.status(500).json({ status: "failed", message: "Internal server error" });
    }
};

export {
    handleResolveChat,
    handleListInstructorChats,
    handleListStudentChats,
    handleGetMessages,
    handleGetMessageById,
    handleEditMessage,
    handleDeleteMessage,
    handleSendMessage,
    handleUploadAttachment,
    handlePusherAuth,
};