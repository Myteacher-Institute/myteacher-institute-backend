import { Request, Response, NextFunction } from "express";
import { Admin } from "../models/admin.model";

type IsAdminErrorT = {
    type: "not-admin" | "server-error",
    message: string
}

const isAdmin = async (req: Request, res: Response<IsAdminErrorT>, next: NextFunction) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                message: 'Unauthorized',
                type: "not-admin"
            });
        }

        const admin = await Admin.findById(userId);

        if (!admin) {
            return res.status(403).json({
                message: 'Access denied. Admin only.',
                type: "not-admin"
            });
        }

        return next();
    } catch (error) {
        console.error('IsAdmin error --->', (error as Error)?.message ?? error);
        res.status(500).json({ message: 'INTERNAL_SERVER_ERROR', type: "server-error" });
    }
};

export { isAdmin };
