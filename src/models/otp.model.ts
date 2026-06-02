import mongoose, { Schema, Document } from 'mongoose';

interface IOtp extends Document {
<<<<<<< HEAD
    accountToVerifyId: mongoose.Types.ObjectId;
    otp: string;
    expiresAt: Date;
    isUsed: boolean
}

const otpSchema = new Schema<IOtp>({
    accountToVerifyId: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    otp: {
        type: String,
        required: true,
        length: 6
    },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
    },
    isUsed: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});


=======
  accountToVerifyId: mongoose.Types.ObjectId;
  otp: string;
  expiresAt: Date;
  isUsed: boolean;
  sendAttempts: number;
  useCase: 'new-account' | 'onboarded-account' | 'reset-password';
}

const otpSchema = new Schema<IOtp>(
  {
    accountToVerifyId: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true,
    },
    sendAttempts: {
      type: Number,
      default: 0,
    },
    otp: {
      type: String,
      required: true,
      length: 6,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    useCase: {
      type: String,
      enum: ['new-account', 'onboarded-account', "reset-password"],
    },
  },
  {
    timestamps: true,
  }
);
>>>>>>> messiah/feat-auth-polish

// Index for cleanup of expired OTPs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Otp = mongoose.model<IOtp>('otp', otpSchema);

export default Otp;
export type { IOtp };
