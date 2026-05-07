import mongoose from 'mongoose';

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';

export type BrowserInfo = {
  name: string | null;
  version: string | null;
};

export type OSInfo = {
  name: string | null;
  version: string | null;
};

export type EngineInfo = {
  name: string | null;
  version: string | null;
};

export type ClientInfo = {
  deviceType: DeviceType;
  browser: BrowserInfo;
  os: OSInfo;
  engine: EngineInfo;
};

export type GeoInfo = {
  country: string | null;
  region: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
  timezone: string | null;
  isp: string | null;
};

export interface IUserSession extends Document {
  userId: mongoose.Types.ObjectId;

  // RAW SIGNALS
  ip: string;
  userAgent: string;

  // PARSED
  client: ClientInfo;
  geo: GeoInfo;

  // SESSION CONTROL
  isRevoked: boolean;
  revokedAt: Date | null;
  lastActive: Date;
  expiresAt: Date;
  logoutAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const UserSessionSchema = new mongoose.Schema<IUserSession>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // RAW SIGNALS
    ip: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: true,
    },

    // PARSED CLIENT INFO
    client: {
      deviceType: {
        type: String,
        enum: ['mobile', 'tablet', 'desktop', 'unknown'],
        default: 'unknown',
      },
      browser: {
        name: { type: String, default: null },
        version: { type: String, default: null },
      },
      os: {
        name: { type: String, default: null },
        version: { type: String, default: null },
      },
      engine: {
        name: { type: String, default: null },
        version: { type: String, default: null },
      },
    },

    // GEO INFO
    geo: {
      country: { type: String, default: null },
      region: { type: String, default: null },
      city: { type: String, default: null },
      lat: { type: Number, default: null },
      lon: { type: Number, default: null },
      timezone: { type: String, default: null },
      isp: { type: String, default: null },
    },

    // SESSION CONTROL
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    logoutAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);



export const Session = mongoose.model<IUserSession>('Session', UserSessionSchema);
