import { IUser } from '@/types';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema<IUser>(
  {
    password: {
      type: String,
      minlength: 6,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    name: {
      type: String,
    },
    phone: {
      type: String,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    hasOnboarded: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["user", "instructor", "admin"]
    }
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('user', userSchema);

export default User;
export type { IUser };


