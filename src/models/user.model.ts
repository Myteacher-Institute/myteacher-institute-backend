import mongoose from 'mongoose';

interface IUser extends mongoose.Document {
  password: string;
  email: string;
  name: string;
  phone?: string;
  isEmailVerified: boolean;
  hasOnboarded: boolean;
  role: "user" | "instructor" | "admin"
}

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


