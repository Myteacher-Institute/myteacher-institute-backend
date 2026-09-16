import mongoose from 'mongoose';

// Chat file attachments are base64 data URLs stored in MongoDB via GridFS —
// this keeps them in the database (never on the backend filesystem) while
// allowing sizes far beyond Mongo's 16 MB per-document BSON limit.

const BUCKET = 'chat_attachments';

const bucket = (): mongoose.mongo.GridFSBucket => {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not ready');
    return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET });
};

const parseDataUrl = (dataUrl: string): { contentType: string; buffer: Buffer } => {
    const match = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
    if (!match) {
        throw new Error('Invalid base64 data URL');
    }
    return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
};

/**
 * Store a base64 data URL in GridFS and return the file _id to reference from
 * a chat message document.
 */
export const saveBase64Attachment = async (dataUrl: string): Promise<mongoose.Types.ObjectId> => {
    const { contentType, buffer } = parseDataUrl(dataUrl);
    const fileId = new mongoose.Types.ObjectId();
    await new Promise<void>((resolve, reject) => {
        const stream = bucket().openUploadStreamWithId(fileId, `attachment-${String(fileId)}`, { metadata: { mime: contentType } });
        stream.on('finish', () => resolve());
        stream.on('error', (err) => reject(err));
        stream.end(buffer);
    });
    return fileId;
};

/**
 * Read a GridFS file back as the original base64 data URL.
 */
export const readBase64Attachment = async (fileId: mongoose.Types.ObjectId): Promise<string> => {
    const bucketRef = bucket();
    const file = await bucketRef.find({ _id: fileId }).next();

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
        const stream = bucketRef.openDownloadStream(fileId);
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve());
    });

    const buffer = Buffer.concat(chunks);
    const mime = (file?.metadata as { mime?: string } | undefined)?.mime ?? 'application/octet-stream';
    return `data:${mime};base64,${buffer.toString('base64')}`;
};

/**
 * Remove a GridFS file (called when a message is deleted for everyone).
 */
export const deleteBase64Attachment = async (fileId: mongoose.Types.ObjectId): Promise<void> => {
    try {
        await bucket().delete(fileId);
    } catch {
        // Ignore missing files — deletion is best-effort.
    }
};