import mongoose from 'mongoose';

interface IUser extends mongoose.Document {
    password: string;
    email: string;
    name: string;
    phone?: string;
    isEmailVerified: boolean;
}

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
    }
}, {
    timestamps: true
});

const User = mongoose.model('user', userSchema);

export default User;
export type { IUser };
