import Pusher from 'pusher';
import config from './env';

let pusherInstance: Pusher | null = null;

export const getPusher = (): Pusher => {
    if (!pusherInstance) {
        pusherInstance = new Pusher({
            appId: config.pusher.appId,
            key: config.pusher.key,
            secret: config.pusher.secret,
            cluster: config.pusher.cluster,
            useTLS: true,
        });
    }
    return pusherInstance;
};

/**
 * Trigger a Pusher event on a private channel scoped to a single user.
 * Used for notifications and user-level events. Errors (including async
 * rejections such as Pusher's 10 KB payload cap) are swallowed so a failed
 * push never crashes the server.
 */
export const triggerToUser = (userId: string, event: string, data: Record<string, unknown>) => {
    getPusher()
        .trigger(`private-user-${userId}`, event, data)
        .catch((err) => console.error('Pusher triggerToUser error:', err?.message ?? err));
};

/**
 * Trigger a Pusher event on a private channel scoped to a chat conversation.
 * Both participants subscribe to the same channel. Errors are swallowed.
 * Callers should strip oversized fields (e.g. base64 attachments) from `data`
 * so the payload stays under Pusher's 10 KB event cap.
 */
export const triggerToChat = (chatId: string, event: string, data: Record<string, unknown>) => {
    getPusher()
        .trigger(`private-chat-${chatId}`, event, data)
        .catch((err) => console.error('Pusher triggerToChat error:', err?.message ?? err));
};
