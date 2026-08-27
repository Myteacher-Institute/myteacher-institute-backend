import { Request, Response } from 'express';
import { User, Instructor, Admin } from '../models';

interface EditUserProfileReqBody {
  name?: string;
  email?: string;
  phone?: string;
  bio?: string;
  expertise?: string[];
  profilePicture?: string;
}

interface EditUserProfileResT {
  status: 'success' | 'failed';
  message: string;
  user?: any;
}

export const handleEditUserProfile = async (
  req: Request<any, any, EditUserProfileReqBody>,
  res: Response<EditUserProfileResT>
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ status: 'failed', message: 'Unauthorized' });
    }

    const { name, email, phone, bio, expertise } = req.body;

    // Note: profilePicture is intentionally NOT handled here. It goes through
    // the dedicated profile-picture upload route so base64 never travels in JSON.

    // Find and update user
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ status: 'failed', message: 'User not found' });
    }

    // Update fields if provided
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) (user as any).bio = bio;
    if (expertise !== undefined) (user as any).expertise = expertise;

    await user.save();

    // Return updated user without password
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    return res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      user: userResponse
    });
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ status: 'failed', message: 'Failed to update profile' });
  }
};

export const handleGetUserProfile = async (
  req: Request,
  res: Response<EditUserProfileResT>
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ status: 'failed', message: 'Unauthorized' });
    }

    const user =
      (await User.findById(req.userId)) ||
      (await Instructor.findById(req.userId)) ||
      (await Admin.findById(req.userId));
    if (!user) {
      return res.status(404).json({ status: 'failed', message: 'User not found' });
    }

    // Return user without password
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    return res.status(200).json({
      status: 'success',
      message: 'Profile retrieved successfully',
      user: userResponse
    });
  } catch (error: any) {
    console.error('Error getting user profile:', error);
    return res.status(500).json({ status: 'failed', message: 'Failed to retrieve profile' });
  }
};

interface ReportBugReqBody {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface ReportBugResT {
  status: 'success' | 'failed';
  message: string;
}

export const handleReportBug = async (
  req: Request<any, any, ReportBugReqBody>,
  res: Response<ReportBugResT>
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ status: 'failed', message: 'Unauthorized' });
    }

    const { title, description, priority } = req.body;

    if (!title || !description) {
      return res.status(400).json({ status: 'failed', message: 'Title and description are required' });
    }

    // Here you would typically save the bug report to a database
    // For now, we'll just log it and return success
    console.log('Bug report:', {
      userId: req.userId,
      title,
      description,
      priority,
      timestamp: new Date()
    });

    return res.status(200).json({
      status: 'success',
      message: 'Bug reported successfully'
    });
  } catch (error: any) {
    console.error('Error reporting bug:', error);
    return res.status(500).json({ status: 'failed', message: 'Failed to report bug' });
  }
};
