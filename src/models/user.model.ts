import mongoose from 'mongoose';
import { IUser } from '../types';

const userSchema = new mongoose.Schema<IUser>({
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    coursesBought: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'course'
    },
    hasOnboarded: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["user", "instructor", "admin"]
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    lastSeen: {
      type: Date
    },
    socketId: {
      type: String
    },
    profilePicture: {
      type: String
    },
    hasAffiliateAccount: {
      type: Boolean,
      default: false
    },
    affiliate_id: {
      type: String,
      unique: true,
      sparse: true
    },
    affiliate_money: {
      type: Number,
      default: 0
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true
    }
}, {
    timestamps: true
});

const User = mongoose.model('user', userSchema);

export default User;
export type { IUser };


