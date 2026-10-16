import { Request, Response, NextFunction } from 'express';
import { User, Admin, Instructor } from '../models';
import { ProtectMiddleWare } from './protect-route';

declare global {
  namespace Express {
    interface User {
      id: string;
      role: 'admin' | 'instructor' | 'user';
    }
  }
}

export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // First use the existing protect middleware to validate tokens
    await new Promise<void>((resolve, reject) => {
      ProtectMiddleWare(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // If protect middleware passed, we have req.userId
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        status: 'failed',
        message: 'User not authenticated'
      });
    }

    // Try to find user in different collections
    let user = await User.findById(userId);
    let role: 'admin' | 'instructor' | 'user' = 'user';

    if (!user) {
      user = await Admin.findById(userId);
      if (user) {
        role = 'admin';
      }
    }

    if (!user) {
      user = await Instructor.findById(userId);
      if (user) {
        role = 'instructor';
      }
    }

    if (!user) {
      return res.status(401).json({
        status: 'failed',
        message: 'User not found'
      });
    }

    // Add user info to request
    req.user = {
      id: userId,
      role
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      status: 'failed',
      message: 'Internal server error'
    });
  }
};
