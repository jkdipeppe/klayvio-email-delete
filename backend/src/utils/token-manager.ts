import { PrismaClient } from '@prisma/client';
import { refreshAccessToken } from '../auth/klaviyo-oauth';
import { encrypt, decrypt } from './encryption';
import { withAccountContext } from './rls';
import { AuthenticationRequiredError } from './auth-errors';

/**
 * Get a valid access token for an account, refreshing if necessary
 * This ensures tokens are always fresh before API calls
 */
export async function getValidAccessToken(
  prisma: PrismaClient,
  accountId: string,
  retryOnDecryptionFailure: boolean = true
): Promise<string> {
  const maxRetries = retryOnDecryptionFailure ? 2 : 1;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Get account with RLS context - reload fresh from database each attempt
      const account = await withAccountContext(prisma, accountId, async () => {
        return await prisma.account.findUnique({
          where: { id: accountId },
        });
      });

      if (!account) {
        throw new Error('Account not found');
      }

      const now = new Date();
      const expiresAt = account.tokenExpiresAt;
      
      // Check if token expires in the next 5 minutes (refresh early to avoid race conditions)
      const bufferTime = 5 * 60 * 1000; // 5 minutes
      const needsRefresh = expiresAt.getTime() - now.getTime() < bufferTime;

      if (needsRefresh) {
        console.log(`Token for account ${accountId} expires soon, refreshing...`);
        
        try {
          const decryptedRefreshToken = decrypt(account.refreshToken);
          const newTokens = await refreshAccessToken(decryptedRefreshToken);
          
          // Update account with new tokens
          await withAccountContext(prisma, accountId, async () => {
            await prisma.account.update({
              where: { id: accountId },
              data: {
                accessToken: encrypt(newTokens.access_token),
                refreshToken: encrypt(newTokens.refresh_token),
                tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
              },
            });
          });
          
          console.log(`Token refreshed successfully for account ${accountId}`);
          return newTokens.access_token;
        } catch (error: any) {
          console.error(`Failed to refresh token for account ${accountId} (attempt ${attempt}/${maxRetries}):`, error);
          // If decryption failed and we have retries left, wait a bit and retry
          if (error.message && error.message.includes('Decryption failed') && attempt < maxRetries) {
            console.log(`Decryption failed, waiting 1 second and retrying with fresh data...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue; // Retry with fresh database read
          }
          if (error.message && error.message.includes('Decryption failed')) {
            throw new AuthenticationRequiredError('Your Klaviyo connection has expired. Please reconnect your account.');
          }
          // Klaviyo returns 400 with { error: 'invalid_grant' } when app was uninstalled, token expired (90d), or revoked
          const isInvalidGrant = error.response?.status === 400 && error.response?.data?.error === 'invalid_grant';
          if (isInvalidGrant || (error.message && (error.message.includes('invalid') || error.message.includes('expired')))) {
            throw new AuthenticationRequiredError('Your Klaviyo connection has expired. Please reconnect your account.');
          }
          throw new Error(`Token refresh failed: ${error.message}. User may need to re-authenticate.`);
        }
      }

      // Token is still valid, return it
      try {
        return decrypt(account.accessToken);
      } catch (error: any) {
        console.error(`Failed to decrypt access token for account ${accountId} (attempt ${attempt}/${maxRetries}):`, error);
        // If decryption failed and we have retries left, wait a bit and retry
        if (error.message && error.message.includes('Decryption failed') && attempt < maxRetries) {
          console.log(`Decryption failed, waiting 1 second and retrying with fresh data...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue; // Retry with fresh database read
        }
        // If decryption failed, throw AuthenticationRequiredError
        if (error.message && error.message.includes('Decryption failed')) {
          throw new AuthenticationRequiredError('Your Klaviyo connection has expired. Please reconnect your account.');
        }
        throw error;
      }
    } catch (error: any) {
      // If this is an AuthenticationRequiredError, don't retry
      if (error instanceof AuthenticationRequiredError) {
        throw error;
      }
      // If it's the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }
      // Otherwise, wait and retry
      console.log(`Error getting token for account ${accountId} (attempt ${attempt}/${maxRetries}), retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error('Failed to get valid access token after retries');
}

/**
 * Check if an account's token is valid (not expired)
 */
export async function isTokenValid(
  prisma: PrismaClient,
  accountId: string
): Promise<boolean> {
  const account = await withAccountContext(prisma, accountId, async () => {
    return await prisma.account.findUnique({
      where: { id: accountId },
      select: { tokenExpiresAt: true },
    });
  });

  if (!account) {
    return false;
  }

  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
  return account.tokenExpiresAt.getTime() - now.getTime() > bufferTime;
}

