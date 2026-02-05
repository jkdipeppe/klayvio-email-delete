import crypto from 'crypto';
import axios from 'axios';

const KLAVIYO_AUTH_URL = 'https://www.klaviyo.com/oauth/authorize';
const KLAVIYO_TOKEN_URL = 'https://a.klaviyo.com/oauth/token';
const KLAVIYO_REVOKE_URL = 'https://a.klaviyo.com/oauth/revoke';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// Generate PKCE codes (required by Klaviyo)
export function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return { codeVerifier, codeChallenge };
}

// Generate authorization URL
export function getAuthorizationUrl(state: string, codeChallenge: string): string {
  if (!process.env.KLAVIYO_CLIENT_ID) {
    throw new Error('KLAVIYO_CLIENT_ID is not set in environment variables');
  }
  if (!process.env.KLAVIYO_REDIRECT_URI) {
    throw new Error('KLAVIYO_REDIRECT_URI is not set in environment variables');
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.KLAVIYO_CLIENT_ID,
    redirect_uri: process.env.KLAVIYO_REDIRECT_URI,
    scope: 'accounts:read profiles:read data-privacy:read data-privacy:write',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${KLAVIYO_AUTH_URL}?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const response = await axios.post(
    KLAVIYO_TOKEN_URL,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.KLAVIYO_REDIRECT_URI!,
      code_verifier: codeVerifier,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      auth: {
        username: process.env.KLAVIYO_CLIENT_ID!,
        password: process.env.KLAVIYO_CLIENT_SECRET!,
      },
    }
  );

  return response.data;
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const response = await axios.post(
    KLAVIYO_TOKEN_URL,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      auth: {
        username: process.env.KLAVIYO_CLIENT_ID!,
        password: process.env.KLAVIYO_CLIENT_SECRET!,
      },
    }
  );

  return response.data;
}

// Revoke OAuth token (for user disconnect/uninstall)
export async function revokeToken(refreshToken: string): Promise<boolean> {
  try {
    await axios.post(
      KLAVIYO_REVOKE_URL,
      new URLSearchParams({
        token: refreshToken,
        token_type_hint: 'refresh_token',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: process.env.KLAVIYO_CLIENT_ID!,
          password: process.env.KLAVIYO_CLIENT_SECRET!,
        },
      }
    );
    console.log('OAuth token revoked successfully');
    return true;
  } catch (error: any) {
    // Token revocation should not fail the disconnect flow
    // The token might already be invalid/expired
    console.error('Token revocation error (non-fatal):', error.response?.data || error.message);
    return false;
  }
}

