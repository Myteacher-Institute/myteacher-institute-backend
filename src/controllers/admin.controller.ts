import { Request, Response } from "express";
import { Admin } from "../models/admin.model";
import bcrypt from "bcryptjs";
import { AddAdminReqBody, AddAdminResT } from "../types/admin.type";

const handleAddAdmin = async (req: Request<AddAdminReqBody>, res: Response<AddAdminResT>) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                status: "failed",
                message: "All fields are required"
            });
        }

        const existingAdmin = await Admin.findOne({ email });

        if (existingAdmin) {
            return res.status(409).json({
                status: "failed",
                message: "Admin with this email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newAdmin = await Admin.create({
            name,
            email,
            password: hashedPassword,
            isAdmin: true
        });

        return res.status(201).json({
            status: "success",
            message: "Admin created successfully",
            admin: {
                name: newAdmin.name,
                email: newAdmin.email,
                isAdmin: newAdmin.isAdmin
            }
        });

    } catch (error) {
        console.error('Add admin error --->', (error as Error)?.message ?? error);
        res.status(500).json({
            status: "failed",
            message: "Internal server error"
        });
    }
};

export { handleAddAdmin };
