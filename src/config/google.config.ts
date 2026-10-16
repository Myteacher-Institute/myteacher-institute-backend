import passport from 'passport';
import { Strategy as GoogleStrategy, VerifyCallback } from 'passport-google-oauth20';
import User from '../models/user.model';
import { Instructor } from '../models/instructor.model';

// Configure Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
    },
    async (accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) => {
      try {
        const email = profile.emails?.[0]?.value;
        const googleId = profile.id;
        const name = profile.displayName || profile.name?.givenName + ' ' + profile.name?.familyName;
        const profilePicture = profile.photos?.[0]?.value;

        if (!email) {
          return done(new Error('No email found in Google profile'));
        }

        // Check if user exists with Google ID
        let user = await User.findOne({ googleId });

        if (user) {
          return done(null, user);
        }

        // Check if user exists with email
        user = await User.findOne({ email });

        if (user) {
          // Link Google account to existing user
          user.googleId = googleId;
          if (!user.profilePicture && profilePicture) {
            user.profilePicture = profilePicture;
          }
          await user.save();
          return done(null, user);
        }

        // Check if instructor exists with Google ID
        let instructor = await Instructor.findOne({ googleId });

        if (instructor) {
          return done(null, instructor as any);
        }

        // Check if instructor exists with email
        instructor = await Instructor.findOne({ email });

        if (instructor) {
          // Link Google account to existing instructor
          instructor.googleId = googleId;
          if (!instructor.profilePicture && profilePicture) {
            instructor.profilePicture = profilePicture;
          }
          await instructor.save();
          return done(null, instructor as any);
        }

        // Create new user.
        // Google already verified the email and provided name/avatar, so the
        // account is fully provisioned - no password/onboarding form is needed.
        const newUser = await User.create({
          email,
          googleId,
          name,
          profilePicture,
          isEmailVerified: true, // Google accounts are verified
          hasOnboarded: true,
          role: 'user',
          hasAffiliateAccount: false,
          affiliate_money: 0,
        });

        return done(null, newUser);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user: any, done: VerifyCallback) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done: VerifyCallback) => {
  try {
    const user = await User.findById(id) || await Instructor.findById(id);
    done(null, user || false);
  } catch (error) {
    done(error as Error);
  }
});

export default passport;
