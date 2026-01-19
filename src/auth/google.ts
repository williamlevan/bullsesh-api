import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface GoogleUserInfo {
  googleId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleUserInfo> {
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Invalid Google token payload');
    }

    if (!payload.email) {
      throw new Error('Email not provided in Google token');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.picture,
    };
  } catch (error) {
    throw new Error(`Google token verification failed: ${(error as Error).message}`);
  }
}
