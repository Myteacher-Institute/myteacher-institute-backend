import { Request, Response } from 'express';
import User from '../models/user.model';

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

    const { name, email, phone, bio, expertise, profilePicture } = req.body;

    // Validate profilePicture if provided
    if (profilePicture) {
      // Check if it's a valid base64 string
      if (!profilePicture.startsWith('data:image/')) {
        return res.status(400).json({ status: 'failed', message: 'Invalid image format' });
      }

      // Extract the base64 part and calculate size
      const base64Data = profilePicture.split(',')[1];
      const sizeInBytes = Buffer.byteLength(base64Data, 'base64');
      const sizeInMB = sizeInBytes / (1024 * 1024);

      // Check if file size exceeds 6MB
      if (sizeInMB > 6) {
        return res.status(400).json({ status: 'failed', message: 'Image size must not exceed 6MB' });
      }
    }

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
    if (profilePicture !== undefined) user.profilePicture = profilePicture;

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

    const user = await User.findById(req.userId);
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
