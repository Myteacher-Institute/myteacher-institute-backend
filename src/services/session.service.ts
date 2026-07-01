import { UAParser } from 'ua-parser-js';

import { generateJWT, IPLocateClient } from '../utils';
import { ClientInfo, DeviceType, GeoInfo, Session } from '../models/session.model';

type GenerateSessionPayload = {
  ip: string;
  userAgent: string;
  userId: string;
};

type GenerateSessionResult =
  | { isSuccessful: true; token: string; sessionId: string }
  | { isSuccessful: false; reason: string };

const resolveDeviceType = (parsed: UAParser.IResult): DeviceType => {
  const type = parsed.device.type?.toLowerCase();
  if (type === 'mobile') return 'mobile';
  if (type === 'tablet') return 'tablet';

  // ua-parser-js doesn't return "desktop" explicitly
  // if os is present and device type is absent, it's a desktop
  if (parsed.os.name) return 'desktop';
  return 'unknown';
};

const parseClient = (userAgent: string): ClientInfo => {
  const parsed = UAParser(userAgent);

  return {
    deviceType: resolveDeviceType(parsed),
    browser: {
      name: parsed.browser.name ?? null,
      version: parsed.browser.version ?? null,
    },
    os: {
      name: parsed.os.name ?? null,
      version: parsed.os.version ?? null,
    },
    engine: {
      name: parsed.engine.name ?? null,
      version: parsed.engine.version ?? null,
    },
  };
};

const parseGeo = async (ip: string): Promise<GeoInfo> => {
  try {
    const lookup = await IPLocateClient.lookup(ip);
    return {
      country: lookup.country ?? null,
      region: lookup.subdivision ?? null,
      city: lookup.city ?? null,
      lat: lookup.latitude ?? null,
      lon: lookup.longitude ?? null,
      timezone: lookup.time_zone ?? null,
      isp: lookup.asn?.name ?? null,
    };
  } catch {
    // geo lookup failing should never block session creation
    return {
      country: null,
      region: null,
      city: null,
      lat: null,
      lon: null,
      timezone: null,
      isp: null,
    };
  }
};

const resolveIp = (ip: string): string => {
  const env = process.env.NODE_ENV;
  if (env === 'development' || env === 'dev') {
    return process.env.PLACEHOLDER_IP || ip;
  }
  return ip;
};

/**
 * Generates a refresh session for long-term user authentication
 * 
 * This session generates for refresh so that user stays logged in for long.
 * After creating a session it returns the session id. that will be used for creating a new token for access usage
 * 
 * @param payload - Session generation parameters
 * @param payload.ip - User's IP address
 * @param payload.userAgent - User's browser user agent string
 * @param payload.userId - User's unique identifier
 * @returns Promise resolving to session generation result with token and sessionId on success, or failure reason
 */

export const generateSession = async ({
  ip,
  userAgent,
  userId,
}: GenerateSessionPayload): Promise<GenerateSessionResult> => {
  try {
    const resolvedIp = resolveIp(ip);

    const [client, geo] = await Promise.all([
      Promise.resolve(parseClient(userAgent)),
      parseGeo(resolvedIp),
    ]);

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const countSessions = await Session.countDocuments({
      userId,
    });

    if (countSessions >= 12) {
      return { isSuccessful: false, reason: 'Too many sessions' };
    }

    const newSession = await Session.create({
      userId,
      ip: resolvedIp,
      userAgent,
      client,
      geo,
      isRevoked: false,
      revokedAt: null,
      lastActive: new Date(),
      expiresAt,
      logoutAt: null,
    });

    const token = generateJWT({
      sessionId: newSession._id.toString(),
      userId,
      type: 'refresh',
    });

    if (!token) {
      await Session.deleteOne({ _id: newSession._id });
      return { isSuccessful: false, reason: 'Token generation failed' };
    }

    return { isSuccessful: true, token, sessionId: newSession._id.toString() };
  } catch (err) {
    console.error('[generateSession] failed:', err);
    return { isSuccessful: false, reason: 'Session creation failed' };
  }
};
