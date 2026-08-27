import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { createCourseCreationJob, createCourseEditJob, getActiveCourseCreations } from "../services/course-creation.service";
import type { CreateCourseCreationReqBody, CreateCourseCreationResT, FetchActiveCourseCreationsResT, CourseCreationPayload } from "../types";

const VIDEO_DIR = path.resolve(process.env.VIDEO_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'videos'));
const ASSET_DIR = path.resolve(process.env.ASSET_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'assets'));

if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });
if (!fs.existsSync(ASSET_DIR)) fs.mkdirSync(ASSET_DIR, { recursive: true });

// Route video_<g> files to the video dir and asset_<g> files to the asset dir
// so the existing upload workers accept the paths they get enqueued with.
const storage = multer.diskStorage({
    destination: (_req, file, cb) => {
        const isVideo = (file.fieldname || '').startsWith('video_');
        cb(null, isVideo ? VIDEO_DIR : ASSET_DIR);
    },
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max per file
});

type StoredFile = Express.Multer.File;

// upload.any() stores files as a flat array; normalize defensively for typing.
const toFileArray = (files: unknown): StoredFile[] => {
    if (Array.isArray(files)) return files as StoredFile[];
    if (files && typeof files === 'object') return Object.values(files).flat() as StoredFile[];
    return [];
};

const parseMetadata = (raw: unknown): CourseCreationPayload | null => {
    if (typeof raw !== 'string' || raw.trim() === '') return null;
    try {
        return JSON.parse(raw) as CourseCreationPayload;
    } catch {
        return null;
    }
};

const validatePayload = (payload: CourseCreationPayload): string | null => {
    if (!payload || typeof payload !== 'object') return "Invalid course metadata";
    if (!payload.courseName?.trim()) return "Course name is required";
    if (!payload.description?.trim()) return "Description is required";
    if (payload.price === undefined || payload.price === null || isNaN(Number(payload.price))) return "Price is required";
    if (payload.duration === undefined || payload.duration === null || isNaN(Number(payload.duration))) return "Duration is required";
    if (!payload.certificate) return "Certificate is required";
    if (!Array.isArray(payload.chapters)) return "chapters must be an array";
    return null;
};

const cleanupFiles = (files: StoredFile[] = []) => {
    for (const file of files) {
        if (file.path && fs.existsSync(file.path)) fs.unlink(file.path, () => {});
    }
};

const handleCreateCourseCreation = async (
    req: Request,
    res: Response<CreateCourseCreationResT>
) => {
    const files = toFileArray((req as { files?: unknown }).files);

    console.log(`[course-creation] >>> handleCreateCourseCreation :: ${files.length} file(s) received:`,
        files.map(f => ({ fieldname: f.fieldname, size: f.size, mimetype: f.mimetype, originalname: f.originalname })));

    try {
        const instructorId = req.userId;
        if (!instructorId) {
            cleanupFiles(files);
            return res.status(401).json({ status: "failed", message: "Unauthorized: Instructor ID not found" });
        }

        const payload = parseMetadata((req.body as CreateCourseCreationReqBody).metadata);
        if (!payload) {
            cleanupFiles(files);
            return res.status(400).json({ status: "failed", message: "Invalid course metadata" });
        }

        const validationError = validatePayload(payload);
        if (validationError) {
            cleanupFiles(files);
            return res.status(400).json({ status: "failed", message: validationError });
        }

        // Compute the global flat video/asset indices exactly like the client
        // does, and match each video/asset that still needs a file to the
        // uploaded multipart file named video_<g> / asset_<g>.
        const videoFiles: { g: number; file: StoredFile; video: any }[] = [];
        const assetFiles: { g: number; file: StoredFile; asset: any }[] = [];

        let videoG = 0;
        for (const chapter of payload.chapters) {
            for (const video of chapter?.videos || []) {
                if (video.videoUrl && String(video.videoUrl).trim() !== '') {
                    console.log(`[course-creation]   video slot video_${videoG}: SKIP (has URL) title="${video.videoTitle || video.title}"`);
                    videoG++;
                    continue;
                }
                const file = files.find(f => f.fieldname === `video_${videoG}`);
               
                if (!file) {
                    cleanupFiles(files);
                    return res.status(400).json({ status: "failed", message: `Missing video file for "${video.videoTitle || video.title || 'untitled video'}"` });
                }
                videoFiles.push({ g: videoG, file, video });
                videoG++;
            }
        }

        let assetG = 0;
        for (const chapter of payload.chapters) {
            for (const asset of chapter?.assets || []) {
                if (asset.url && String(asset.url).trim() !== '') {
                    console.log(`[course-creation]   asset slot asset_${assetG}: SKIP (has URL) name="${asset.name}"`);
                    assetG++;
                    continue;
                }
                const file = files.find(f => f.fieldname === `asset_${assetG}`);
               
                if (!file) {
                    cleanupFiles(files);
                    return res.status(400).json({ status: "failed", message: `Missing asset file for "${asset.name || 'untitled asset'}"` });
                }
                assetFiles.push({ g: assetG, file, asset });
                assetG++;
            }
        }

        // Clean up any uploaded file that wasn't consumed (mismatched field names).
        const consumed = new Set([...videoFiles, ...assetFiles].map(x => x.file.path));
        for (const file of files) {
            if (!consumed.has(file.path)) fs.unlink(file.path, () => {});
        }

        const videos = videoFiles.map(({ g, file, video }) => ({
            ci: 0,
            vi: 0,
            g,
            filePath: path.resolve(file.path),
            originalName: file.originalname,
            title: video.videoTitle || file.originalname,
            description: video.videoDescription || "",
            videoTitle: video.videoTitle || "",
            videoDescription: video.videoDescription || "",
            videoDuration: Number(video.videoDuration) || 0,
            isProgrammingVideo: !!video.isProgrammingVideo,
            isPreview: !!video.isPreview,
        }));

        // Resolve ci/vi for each video/asset from the payload chapters.
        let vIdx = 0;
        for (let ci = 0; ci < payload.chapters.length; ci++) {
            const ch = payload.chapters[ci];
            for (let vi = 0; vi < (ch?.videos || []).length; vi++) {
                const video = ch.videos[vi];
                if (!video.videoUrl || String(video.videoUrl).trim() === '') {
                    if (videos[vIdx]) {
                        videos[vIdx].ci = ci;
                        videos[vIdx].vi = vi;
                    }
                    vIdx++;
                }
            }
        }

        const assets = assetFiles.map(({ g, file, asset }) => ({
            ci: 0,
            ai: 0,
            g,
            filePath: path.resolve(file.path),
            originalName: file.originalname,
            name: asset.name || file.originalname,
            mimeType: file.mimetype,
        }));

        let aIdx = 0;
        for (let ci = 0; ci < payload.chapters.length; ci++) {
            const ch = payload.chapters[ci];
            for (let ai = 0; ai < (ch?.assets || []).length; ai++) {
                const asset = ch.assets[ai];
                if (!asset.url || String(asset.url).trim() === '') {
                    if (assets[aIdx]) {
                        assets[aIdx].ci = ci;
                        assets[aIdx].ai = ai;
                    }
                    aIdx++;
                }
            }
        }

        const { jobId } = await createCourseCreationJob(instructorId, payload, videos, assets);

        return res.status(201).json({
            status: "success",
            message: "Course creation started. You will be notified when it finishes.",
            jobId,
        });
    } catch (error) {
        cleanupFiles(files);
        console.error('Course creation enqueue error --->', (error as Error)?.message ?? error);
        res.status(500).json({ status: "failed", message: "Internal server error while starting course creation" });
    }
};

// Same resumable pipeline as creation, but for updating an existing course. The
// instructor posts multipart metadata + only the NEW video/asset files; the job
// uploads them in the background then applies the update, so the dashboard can
// show progress and the instructor can leave the page safely.
const handleCreateCourseEdit = async (
    req: Request<{ courseId: string }>,
    res: Response<CreateCourseCreationResT>
) => {
    const files = toFileArray((req as { files?: unknown }).files);
    const { courseId } = req.params;

    try {
        const instructorId = req.userId;
        if (!instructorId) {
            cleanupFiles(files);
            return res.status(401).json({ status: "failed", message: "Unauthorized: Instructor ID not found" });
        }

        if (!courseId) {
            cleanupFiles(files);
            return res.status(400).json({ status: "failed", message: "Course ID is required" });
        }

        const payload = parseMetadata((req.body as CreateCourseCreationReqBody).metadata);
        if (!payload) {
            cleanupFiles(files);
            return res.status(400).json({ status: "failed", message: "Invalid course metadata" });
        }

        const validationError = validatePayload(payload);
        if (validationError) {
            cleanupFiles(files);
            return res.status(400).json({ status: "failed", message: validationError });
        }

        const matched = matchFilesToPayload(files, payload);
        if (!matched.ok) {
            cleanupFiles(files);
            return res.status(400).json({ status: "failed", message: matched.error });
        }

        // Clean up any uploaded file that wasn't consumed (mismatched field names).
        const consumed = new Set([...matched.videoFiles, ...matched.assetFiles].map(x => x.file.path));
        for (const file of files) {
            if (!consumed.has(file.path)) fs.unlink(file.path, () => {});
        }

        const videos = resolveVideoIndices(matched.videoFiles, payload);
        const assets = resolveAssetIndices(matched.assetFiles, payload);

        const { jobId } = await createCourseEditJob(instructorId, courseId, payload, videos, assets);

        return res.status(201).json({
            status: "success",
            message: "Course update started. You will be notified when it finishes.",
            jobId,
        });
    } catch (error) {
        cleanupFiles(files);
        console.error('Course edit enqueue error --->', (error as Error)?.message ?? error);
        res.status(500).json({ status: "failed", message: "Internal server error while starting course update" });
    }
};

// Match the payload's file-needing videos/assets to the uploaded multipart files
// named video_<g> / asset_<g> using the same global index the client uses. Returns
// the matched files (or an error message if any required file is missing).
const matchFilesToPayload = (files: StoredFile[], payload: CourseCreationPayload):
    | { ok: true; videoFiles: { g: number; file: StoredFile; video: any }[]; assetFiles: { g: number; file: StoredFile; asset: any }[] }
    | { ok: false; error: string } => {
    const videoFiles: { g: number; file: StoredFile; video: any }[] = [];
    const assetFiles: { g: number; file: StoredFile; asset: any }[] = [];

    let videoG = 0;
    for (const chapter of payload.chapters) {
        for (const video of chapter?.videos || []) {
            if (video.videoUrl && String(video.videoUrl).trim() !== '') {
                videoG++;
                continue;
            }
            const file = files.find(f => f.fieldname === `video_${videoG}`);
            if (!file) {
                return { ok: false, error: `Missing video file for "${video.videoTitle || video.title || 'untitled video'}"` };
            }
            videoFiles.push({ g: videoG, file, video });
            videoG++;
        }
    }

    let assetG = 0;
    for (const chapter of payload.chapters) {
        for (const asset of chapter?.assets || []) {
            if (asset.url && String(asset.url).trim() !== '') {
                assetG++;
                continue;
            }
            const file = files.find(f => f.fieldname === `asset_${assetG}`);
            if (!file) {
                return { ok: false, error: `Missing asset file for "${asset.name || 'untitled asset'}"` };
            }
            assetFiles.push({ g: assetG, file, asset });
            assetG++;
        }
    }

    return { ok: true, videoFiles, assetFiles };
};

// Resolve ci/vi and ci/ai for each matched file so the worker knows exactly
// where each upload belongs in the payload chapters.
const resolveVideoIndices = (videoFiles: { g: number; file: StoredFile; video: any }[], payload: CourseCreationPayload) => {
    const videos = videoFiles.map(({ g, file, video }) => ({
        ci: 0,
        vi: 0,
        g,
        filePath: path.resolve(file.path),
        originalName: file.originalname,
        title: video.videoTitle || file.originalname,
        description: video.videoDescription || "",
        videoTitle: video.videoTitle || "",
        videoDescription: video.videoDescription || "",
        videoDuration: Number(video.videoDuration) || 0,
        isProgrammingVideo: !!video.isProgrammingVideo,
        isPreview: !!video.isPreview,
    }));

    let vIdx = 0;
    for (let ci = 0; ci < payload.chapters.length; ci++) {
        const ch = payload.chapters[ci];
        for (let vi = 0; vi < (ch?.videos || []).length; vi++) {
            const video = ch.videos[vi];
            if (!video.videoUrl || String(video.videoUrl).trim() === '') {
                if (videos[vIdx]) {
                    videos[vIdx].ci = ci;
                    videos[vIdx].vi = vi;
                }
                vIdx++;
            }
        }
    }

    return videos;
};

const resolveAssetIndices = (assetFiles: { g: number; file: StoredFile; asset: any }[], payload: CourseCreationPayload) => {
    const assets = assetFiles.map(({ g, file, asset }) => ({
        ci: 0,
        ai: 0,
        g,
        filePath: path.resolve(file.path),
        originalName: file.originalname,
        name: asset.name || file.originalname,
        mimeType: file.mimetype,
    }));

    let aIdx = 0;
    for (let ci = 0; ci < payload.chapters.length; ci++) {
        const ch = payload.chapters[ci];
        for (let ai = 0; ai < (ch?.assets || []).length; ai++) {
            const asset = ch.assets[ai];
            if (!asset.url || String(asset.url).trim() === '') {
                if (assets[aIdx]) {
                    assets[aIdx].ci = ci;
                    assets[aIdx].ai = ai;
                }
                aIdx++;
            }
        }
    }

    return assets;
};

const handleFetchActiveCourseCreations = async (req: Request, res: Response<FetchActiveCourseCreationsResT>) => {
    try {
        const instructorId = req.userId;
        if (!instructorId) {
            return res.status(401).json({ status: "failed", message: "Unauthorized: Instructor ID not found" });
        }

        const jobs = await getActiveCourseCreations(instructorId);

        return res.status(200).json({
            status: "success",
            message: "Active course creations fetched successfully",
            jobs,
        });
    } catch (error) {
        console.error('Fetch active course creations error --->', (error as Error)?.message ?? error);
        res.status(500).json({ status: "failed", message: "Internal server error" });
    }
};

export { handleCreateCourseCreation, handleCreateCourseEdit, handleFetchActiveCourseCreations, upload };
