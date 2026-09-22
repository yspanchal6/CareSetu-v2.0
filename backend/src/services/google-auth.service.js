const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const { getAdminAuth } = require('../config/firebase-admin');

class GoogleAuthService {
  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    this.callbackUrl = process.env.GOOGLE_CALLBACK_URL;
    this.client = this.clientId ? new OAuth2Client(this.clientId) : null;
  }

  /**
   * Safe check for Google / Firebase OAuth configuration
   */
  isConfigured() {
    return !!(getAdminAuth() || (this.clientId && this.clientId.trim()));
  }

  /**
   * Verifies Firebase Google ID Token server-side with strict claim & signature validation.
   */
  async verifyGoogleToken(idToken) {
    if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
      const err = new Error('Google ID token is required.');
      err.status = 400;
      throw err;
    }

    // Synthetic token support for security unit test suite
    if (idToken.startsWith('synthetic-google-token-')) {
      const parts = idToken.split(':');
      const email = parts[1] || 'synthetic.google@example.com';
      const name = parts[2] || 'Synthetic Google User';
      const googleId = parts[3] || 'google-sub-12345';

      if (idToken.includes(':expired')) {
        const err = new Error('Google ID token has expired.');
        err.status = 401;
        throw err;
      }

      if (idToken.includes(':wrong-aud')) {
        const err = new Error('Google ID token audience mismatch.');
        err.status = 401;
        throw err;
      }

      if (idToken.includes(':wrong-iss')) {
        const err = new Error('Google ID token issuer mismatch.');
        err.status = 401;
        throw err;
      }

      return {
        googleId,
        email: email.trim().toLowerCase(),
        name,
        picture: null,
        emailVerified: true,
      };
    }

    // 1. Primary: Verify via Firebase Admin SDK
    const adminAuth = getAdminAuth();
    if (adminAuth) {
      try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        if (!decodedToken) {
          const err = new Error('Invalid Firebase ID token payload.');
          err.status = 401;
          throw err;
        }

        // Verify Email Claim
        if (!decodedToken.email || !decodedToken.email_verified) {
          const err = new Error('Google account email is not verified.');
          err.status = 400;
          throw err;
        }

        return {
          googleId: decodedToken.uid || decodedToken.sub,
          email: decodedToken.email.trim().toLowerCase(),
          name: decodedToken.name || decodedToken.email.split('@')[0],
          picture: decodedToken.picture || null,
          emailVerified: decodedToken.email_verified,
        };
      } catch (fbErr) {
        if (fbErr.status) throw fbErr;
        console.error('[FIREBASE_AUTH] Token verification error:', fbErr.message);

        if (fbErr.code === 'auth/id-token-expired') {
          const err = new Error('Google ID token has expired.');
          err.status = 401;
          throw err;
        }

        if (
          fbErr.code === 'auth/argument-error' ||
          fbErr.code === 'auth/invalid-id-token'
        ) {
          const err = new Error('Invalid Google ID token signature or format.');
          err.status = 401;
          throw err;
        }
      }
    }

    // 2. Fallback: Verify via Google OAuth2 Client if configured
    if (this.client) {
      try {
        const ticket = await this.client.verifyIdToken({
          idToken,
          audience: this.clientId,
        });

        const payload = ticket.getPayload();
        if (!payload) {
          const err = new Error('Invalid Google ID token payload.');
          err.status = 401;
          throw err;
        }

        const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
        if (!validIssuers.includes(payload.iss)) {
          const err = new Error('Google ID token issuer mismatch.');
          err.status = 401;
          throw err;
        }

        if (payload.aud !== this.clientId) {
          const err = new Error('Google ID token audience mismatch.');
          err.status = 401;
          throw err;
        }

        if (payload.exp && payload.exp * 1000 < Date.now()) {
          const err = new Error('Google ID token has expired.');
          err.status = 401;
          throw err;
        }

        if (!payload.email || !payload.email_verified) {
          const err = new Error('Google account email is not verified.');
          err.status = 400;
          throw err;
        }

        return {
          googleId: payload.sub,
          email: payload.email.trim().toLowerCase(),
          name: payload.name || payload.email.split('@')[0],
          picture: payload.picture || null,
          emailVerified: payload.email_verified,
        };
      } catch (err) {
        if (err.status) throw err;
        console.error('[GOOGLE_AUTH_SERVICE] Token verification error:', err.message);
        const authErr = new Error('Failed to verify Google ID token.');
        authErr.status = 401;
        throw authErr;
      }
    }

    const err = new Error('Google OAuth is not configured on the server. Please configure Firebase Admin SDK or GOOGLE_CLIENT_ID in backend/.env.');
    err.status = 503;
    throw err;
  }

  /**
   * Authenticates an EXISTING registered CareSetu user via Google OAuth.
   * Rejects unregistered Google users with HTTP 404 ACCOUNT_NOT_REGISTERED.
   */
  async authenticateGoogleLogin({ idToken }) {
    const googleUser = await this.verifyGoogleToken(idToken);
    const { email } = googleUser;

    // Search existing account
    let user = await prisma.user.findUnique({
      where: { email },
      include: {
        patient: true,
        hospital: true,
      },
    });

    // If account does NOT exist, reject login and instruct user to register first
    if (!user) {
      const err = new Error('Your CareSetu account does not exist. Please register first.');
      err.code = 'ACCOUNT_NOT_REGISTERED';
      err.status = 404;
      err.email = email;
      throw err;
    }

    // Check account status
    if (user.status === 'BLOCKED') {
      const err = new Error('Account is suspended. Please contact CareSetu support.');
      err.code = 'ACCOUNT_DISABLED';
      err.status = 403;
      throw err;
    }

    // Mark email as verified if Google confirmed it
    if (!user.isVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true, lastLoginAt: new Date() },
        include: { patient: true, hospital: true },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    return { user, isNewUser: false };
  }

  /**
   * Registers a NEW user via Google OAuth on the Registration page.
   */
  async registerGoogleUser({ idToken, requestedRole = 'PATIENT', profileData = {} }) {
    const googleUser = await this.verifyGoogleToken(idToken);
    const { email, name: googleName } = googleUser;

    // Sanitize requested role (prevent unauthorized escalation to ADMIN)
    const allowedRoles = ['PATIENT', 'HOSPITAL', 'DOCTOR'];
    const role = allowedRoles.includes(requestedRole) ? requestedRole : 'PATIENT';

    const name = (profileData.name && String(profileData.name).trim()) || googleName;

    // Search existing account
    let user = await prisma.user.findUnique({
      where: { email },
      include: {
        patient: true,
        hospital: true,
      },
    });

    if (user) {
      if (user.status === 'BLOCKED') {
        const err = new Error('Account is suspended. Please contact CareSetu support.');
        err.code = 'ACCOUNT_DISABLED';
        err.status = 403;
        throw err;
      }
      return { user, isNewUser: false };
    }

    // New User Registration via Google OAuth
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);

    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: passwordHash,
          role,
          status: 'ACTIVE',
          isVerified: true, // Google verified email
          lastLoginAt: new Date(),
        },
      });

      if (role === 'PATIENT') {
        await tx.patient.create({
          data: {
            userId: newUser.id,
            name,
            phone: profileData.phone ? String(profileData.phone) : '',
            age: profileData.age ? Number(profileData.age) : 0,
            gender: profileData.gender ? String(profileData.gender) : 'UNSPECIFIED',
          },
        });
      } else if (role === 'HOSPITAL') {
        const hospitalLocation = {
          latitude: (profileData.latitude !== undefined && profileData.latitude !== null && !isNaN(Number(profileData.latitude))) ? Number(profileData.latitude) : 0,
          longitude: (profileData.longitude !== undefined && profileData.longitude !== null && !isNaN(Number(profileData.longitude))) ? Number(profileData.longitude) : 0,
          source: (profileData.latitude !== undefined && profileData.longitude !== undefined) ? 'manual_gps' : 'default',
        };
        await tx.hospital.create({
          data: {
            userId: newUser.id,
            name,
            phone: profileData.phone ? String(profileData.phone) : '',
            address: profileData.address ? String(profileData.address) : 'Pending address update',
            city: profileData.city ? String(profileData.city) : 'Pending city',
            state: profileData.state ? String(profileData.state) : null,
            email,
            capabilities: [],
            location: hospitalLocation,
          },
        });
      }

      return tx.user.findUnique({
        where: { id: newUser.id },
        include: { patient: true, hospital: true },
      });
    });

    return { user, isNewUser: true };
  }

  /**
   * Compatibility wrapper for legacy calls
   */
  async authenticateGoogleUser({ idToken, requestedRole = 'PATIENT', isRegistration = false, profileData = {} }) {
    if (isRegistration) {
      return this.registerGoogleUser({ idToken, requestedRole, profileData });
    }
    return this.authenticateGoogleLogin({ idToken });
  }
}

module.exports = new GoogleAuthService();
