import mongoose from 'mongoose';
import Chat from '../models/chat.model';
import Message from '../models/message.model';
import MentorshipRequest from '../models/mentorship-request.model';
import { triggerToChat, triggerToUser } from '../config/pusher';
import { saveBase64Attachment, readBase64Attachment, deleteBase64Attachment } from './attachment-storage.service';

// ============ Helpers ============

/**
 * For a given chat + viewer, return the last message and the number of
 * messages sent by the other participant that have not been read yet.
 */
const enrichChat = async (chat: any, viewerId: string) => {
    const viewingPartyId = chat.instructorId.toString() === viewerId
        ? chat.instructorId
        : chat.studentId;

    const [lastMessage, unreadCount] = await Promise.all([
        Message.findOne({
            chatId: chat._id,
            isDeleted: { $ne: true },
            deletedFor: { $ne: viewerId },
        }).sort({ createdAt: -1 }).lean(),
        Message.countDocuments({
            chatId: chat._id,
            senderId: { $ne: viewingPartyId },
            readBy: { $ne: viewerId },
        }),
    ]);

    return {
        chatId: chat._id,
        mentorshipId: chat.mentorshipId,
        participant: chat.instructorId.toString() === viewerId ? chat.studentId : chat.instructorId,
        lastMessageAt: chat.lastMessageAt || lastMessage?.createdAt || null,
        lastMessage: lastMessage
            ? {
                _id: lastMessage._id,
                content: lastMessage.content ?? null,
                attachmentType: lastMessage.attachmentType ?? null,
                senderId: lastMessage.senderId,
                senderType: lastMessage.senderType,
                createdAt: lastMessage.createdAt,
            }
            : null,
        unreadCount,
    };
};

// ============ Conversations ============

export const getOrCreateChat = async (mentorshipId: string, studentId: string, instructorId: string) => {
    let chat = await Chat.findOne({ mentorshipId }).lean();
    if (!chat) {
        chat = await Chat.create({ mentorshipId, studentId, instructorId, lastMessageAt: new Date() });
    }
    return chat as any as {
        _id: mongoose.Types.ObjectId;
        mentorshipId: mongoose.Types.ObjectId;
        studentId: mongoose.Types.ObjectId;
        instructorId: mongoose.Types.ObjectId;
    };
};

export const getChatForMentorship = async (mentorshipId: string) => {
    return Chat.findOne({ mentorshipId }).lean();
};

/**
 * Resolve the conversation for a specific program. Verifies the caller is one
 * of the two participants (student or instructor), then lazily creates the
 * chat the first time it is opened.
 */
export const resolveChatForMentorship = async (mentorshipId: string, viewerId: string) => {
    if (!mongoose.Types.ObjectId.isValid(mentorshipId)) return null;

    const request = await MentorshipRequest.findById(mentorshipId);
    if (!request) return null;

    const studentId = request.studentId.toString();
    const instructorId = request.instructorId.toString();
    if (viewerId !== studentId && viewerId !== instructorId) return null;

    const chat = await getOrCreateChat(mentorshipId, studentId, instructorId);
    return { chatId: chat._id, mentorshipId, studentId, instructorId };
};

export const findChatById = async (chatId: string) => {
    if (!mongoose.Types.ObjectId.isValid(chatId)) return null;
    return Chat.findById(chatId);
};

export const isChatParticipant = (chat: any, participantId: string) =>
    chat.studentId.toString() === participantId || chat.instructorId.toString() === participantId;

export const listInstructorChats = async (instructorId: string) => {
    const chats = await Chat.find({ instructorId })
        .populate('studentId', 'name profilePicture email')
        .sort({ lastMessageAt: -1 })
        .lean();

    return Promise.all(chats.map(chat => enrichChat(chat, instructorId)));
};

/**
 * Ensure a conversation exists for every program the instructor mentors
 * (paid, active or ended), so the mentorship dashboard lists all students
 * even before the first message is sent.
 */
export const ensureChatsForInstructor = async (instructorId: string) => {
    const requests = await MentorshipRequest.find({ instructorId, status: { $in: ['paid', 'active', 'ended'] } })
        .select('studentId')
        .lean();

    await Promise.all(requests.map((r) =>
        Chat.updateOne(
            { mentorshipId: r._id },
            {
                $setOnInsert: {
                    mentorshipId: r._id,
                    studentId: r.studentId,
                    instructorId,
                    lastMessageAt: new Date(),
                },
            },
            { upsert: true }
        )
    ));
};

export const listStudentChats = async (studentId: string) => {
    const chats = await Chat.find({ studentId })
        .populate('instructorId', 'name profilePicture email specialization mentorshipPrice')
        .sort({ lastMessageAt: -1 })
        .lean();

    return Promise.all(chats.map(chat => enrichChat(chat, studentId)));
};

// ============ Messages ============

/**
 * Build the client-facing view of a message doc. For "deleted for me"
 * messages, blank out the content/attachment from this viewer's perspective.
 */
const messageView = (m: any, viewerId?: string) => {
    const deletedForMe = viewerId ? (m.deletedFor ?? []).some((id: any) => id.toString() === viewerId) : false;
    const deleted = m.isDeleted || deletedForMe;

    return {
        _id: m._id,
        senderId: m.senderId,
        senderType: m.senderType,
        content: deleted ? null : (m.content ?? null),
        attachmentUrl: deleted ? null : (m.attachmentUrl ?? null),
        attachmentData: deleted ? null : (m.attachmentData ?? null),
        attachmentType: deleted ? null : (m.attachmentType ?? null),
        attachmentName: deleted ? null : (m.attachmentName ?? null),
        edited: !!m.edited,
        isDeleted: deleted,
        deletedForMe,
        createdAt: m.createdAt,
        readBy: (m.readBy ?? []).map((r: mongoose.Types.ObjectId) => r.toString()),
    };
};

export const getChatMessages = async (chatId: string, viewerId: string) => {    if (!mongoose.Types.ObjectId.isValid(chatId)) return null;
    const chat = await Chat.findById(chatId);
    if (!chat || !isChatParticipant(chat, viewerId)) return null;

    // Mark all messages from the other party as read
    await Message.updateMany(
        { chatId, senderId: { $ne: viewerId }, readBy: { $ne: viewerId } },
        { $addToSet: { readBy: viewerId } }
    );

    const messages = await Message.find({ chatId }).sort({ createdAt: 1 }).lean();

    return {
        chatId,
        mentorshipId: chat.mentorshipId,
        studentId: chat.studentId,
        instructorId: chat.instructorId,
        messages: messages.filter((m: any) => !m.isDeleted && !(m.deletedFor ?? []).some((id: any) => id.toString() === viewerId)).map((m: any) => messageView(m, viewerId)),
    };
};

export const sendChatMessage = async (input: {
    chatId: string;
    senderId: string;
    content?: string;
    attachmentUrl?: string;
    attachmentData?: string;
    attachmentType?: 'image' | 'voice' | 'file';
    attachmentName?: string;
}) => {
    const { chatId, senderId, content, attachmentUrl, attachmentData, attachmentType, attachmentName } = input;

    if (!content?.trim() && !attachmentUrl && !attachmentData) {
        return { success: false as const, message: 'Message content is required' };
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return { success: false as const, message: 'Conversation not found' };
    if (!isChatParticipant(chat, senderId)) {
        return { success: false as const, message: 'You are not part of this conversation' };
    }

    const senderType = chat.instructorId.toString() === senderId ? 'instructor' : 'user';

    // File attachments are stored as base64 in GridFS (MongoDB) rather than
    // inline in the message document, which is capped at 16 MB per BSON doc.
    // Images and voice notes stay inline (they are small by design).
    let attachmentFileId: mongoose.Types.ObjectId | undefined;
    let storedData: string | undefined;
    if (attachmentType === 'file' && attachmentData) {
        attachmentFileId = await saveBase64Attachment(attachmentData);
    } else {
        storedData = attachmentData;
    }

    const message = await Message.create({
        chatId,
        senderId,
        senderType,
        content: content?.trim() || undefined,
        attachmentUrl,
        attachmentData: storedData,
        attachmentFileId,
        attachmentType,
        attachmentName: attachmentName?.trim() ? attachmentName.trim() : undefined,
    });

    chat.lastMessageAt = message.createdAt;
    await chat.save();

    // The sender receives the same base64 they uploaded. For GridFS-backed
    // files the doc has no data, so echo the original from the request.
    const fullAttachmentData = attachmentFileId
        ? (attachmentData ?? null)
        : (message.attachmentData ?? null);

    // Full message returned to the sender (includes base64 attachmentData).
    const fullMessage = {
        _id: message._id,
        senderId: message.senderId,
        senderType: message.senderType,
        content: message.content ?? null,
        attachmentUrl: message.attachmentUrl ?? null,
        attachmentData: fullAttachmentData,
        attachmentType: message.attachmentType ?? null,
        attachmentName: message.attachmentName ?? null,
        createdAt: message.createdAt,
        readBy: [],
        edited: false,
        isDeleted: false,
        deletedFor: [],
    };

    // Pusher payload: attachmentData is intentionally omitted — full base64
    // attachments can exceed Pusher's 10 KB event cap (HTTP 413), so the
    // receiving client fetches the full message by id when it carries one.
    const pusherMessage = { ...fullMessage, attachmentData: null };

    // Trigger Pusher event on the chat channel — both participants receive it in real time
    triggerToChat(chatId.toString(), 'new-message', { chatId, message: pusherMessage });

    return { success: true as const, message: 'Message sent', data: fullMessage };
};

/**
 * Fetch a single message by id. Used by the receiving client to load the full
 * message (including base64 attachmentData, which is omitted from Pusher's
 * real-time event to stay under the 10 KB payload cap). Verifies the viewer is
 * a participant of the chat.
 */
export const getChatMessageById = async (chatId: string, messageId: string, viewerId: string) => {
    if (!mongoose.Types.ObjectId.isValid(chatId) || !mongoose.Types.ObjectId.isValid(messageId)) return null;

    const chat = await Chat.findById(chatId);
    if (!chat || !isChatParticipant(chat, viewerId)) return null;

    const m = await Message.findOne({ _id: messageId, chatId }).lean();
    if (!m || m.isDeleted) return null;

    const view = messageView(m, viewerId);

    // GridFS-backed file attachments return their base64 data on demand so the
    // message document itself stays small (Pusher events omit it too).
    if (m.attachmentFileId && m.attachmentType === 'file') {
        try {
            view.attachmentData = await readBase64Attachment(m.attachmentFileId);
        } catch {
            // stored file unavailable — keep attachmentData null
        }
    }

    return view;
};

// ============ Edit / Delete ============

/**
 * Edit a message's text. Only the sender may edit, and only the text may be
 * changed (attachments are immutable). Broadcasts a `message-updated` Pusher
 * event so both participants see the change in real time.
 */
export const editChatMessage = async (input: {
    chatId: string;
    messageId: string;
    viewerId: string;
    content: string;
}) => {
    const { chatId, messageId, viewerId, content } = input;

    if (!mongoose.Types.ObjectId.isValid(chatId) || !mongoose.Types.ObjectId.isValid(messageId)) {
        return { success: false as const, message: 'Invalid chat or message' };
    }
    if (!content?.trim()) {
        return { success: false as const, message: 'Message content is required' };
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return { success: false as const, message: 'Conversation not found' };
    if (!isChatParticipant(chat, viewerId)) {
        return { success: false as const, message: 'You are not part of this conversation' };
    }

    const message = await Message.findOne({ _id: messageId, chatId });
    if (!message || message.isDeleted) {
        return { success: false as const, message: 'Message not found' };
    }
    if (message.senderId.toString() !== viewerId) {
        return { success: false as const, message: 'You can only edit your own messages' };
    }

    message.content = content.trim();
    message.edited = true;
    await message.save();

    const view = messageView(message, viewerId);
    const pusherView = { ...view, attachmentData: null };
    triggerToChat(chatId.toString(), 'message-updated', { chatId, message: pusherView });

    return { success: true as const, message: 'Message updated', data: view, pusher: pusherView };
};

/**
 * Delete a chat message.
 *  - mode "me": hides the message for the current participant only (persisted
 *    in `deletedFor` so refetching the conversation keeps it hidden for them).
 *  - mode "general": removes the message for everyone. Any participant of the
 *    conversation may do this (student or instructor). Content/attachments are
 *    cleared and the message is excluded from listings.
 */
export const deleteChatMessage = async (input: {
    chatId: string;
    messageId: string;
    viewerId: string;
    mode: 'me' | 'general';
}) => {
    const { chatId, messageId, viewerId, mode } = input;

    if (!mongoose.Types.ObjectId.isValid(chatId) || !mongoose.Types.ObjectId.isValid(messageId)) {
        return { success: false as const, message: 'Invalid chat or message' };
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return { success: false as const, message: 'Conversation not found' };
    if (!isChatParticipant(chat, viewerId)) {
        return { success: false as const, message: 'You are not part of this conversation' };
    }

    const message = await Message.findOne({ _id: messageId, chatId });
    if (!message) return { success: false as const, message: 'Message not found' };

    if (mode === 'general') {
        message.isDeleted = true;
        message.content = undefined;
        message.attachmentUrl = undefined;
        message.attachmentData = undefined;
        await message.save();
        // Remove any GridFS-stored base64 alongside the message.
        if (message.attachmentFileId) {
            await deleteBase64Attachment(message.attachmentFileId);
        }
        triggerToChat(chatId.toString(), 'message-deleted', { chatId, messageId, mode: 'general' });
        return { success: true as const, message: 'Message deleted', mode: 'general' as const };
    }

    // mode "me" — any participant can hide the message from their own view
    if (!message.deletedFor.some((id) => id.toString() === viewerId)) {
        message.deletedFor.push(new mongoose.Types.ObjectId(viewerId));
        await message.save();
    }
    // Notify only this user (across their sessions) so the message disappears live.
    triggerToUser(viewerId, 'message-deleted', { chatId, messageId, mode: 'me', deletedBy: viewerId });
    return { success: true as const, message: 'Message deleted for you', mode: 'me' as const, data: messageView(message, viewerId) };
};
