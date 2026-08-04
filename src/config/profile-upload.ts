import multer from "multer";
import path from "path";
import fs from "fs";

// Profile pictures are saved to disk and served from /uploads/profile-pictures,
// so the profile edit endpoints never receive base64 blobs in JSON.
export const PROFILE_UPLOAD_DIR = path.resolve(
    process.env.PROFILE_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'profile-pictures')
);

if (!fs.existsSync(PROFILE_UPLOAD_DIR)) {
    fs.mkdirSync(PROFILE_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PROFILE_UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
        return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
};

export const profileUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 6 * 1024 * 1024 }, // 6MB — matches the old base64 validation
});
