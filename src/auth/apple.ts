import appleSignin from 'apple-signin-auth';

const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;

export interface AppleUserInfo {
  appleId: string;
  email: string;
  name?: string;
}

export async function verifyAppleToken(idToken: string): Promise<AppleUserInfo> {
  try {
    const payload = await appleSignin.verifyIdToken(idToken, {
      audience: APPLE_CLIENT_ID,
      ignoreExpiration: false,
    });

    if (!payload.email) {
      throw new Error('Email not provided in Apple token');
    }

    return {
      appleId: payload.sub,
      email: payload.email,
      // Note: Apple only provides name on first sign-in
      // and it comes from the authorization response, not the token
    };
  } catch (error) {
    throw new Error(`Apple token verification failed: ${(error as Error).message}`);
  }
}
