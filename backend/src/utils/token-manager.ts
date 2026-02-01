import { PrismaClient } from '@prisma/client';
import { refreshAccessToken } from '../auth/klaviyo-oauth';
import { encrypt, decrypt } from './encryption';
import { withAccountContext } from './rls';

/**
 * Get a valid access token for an account, refreshing if necessary
 * This ensures tokens are always fresh before API calls
 */
export async function getValidAccessToken(
  prisma: PrismaClient,
  accountId: string
): Promise<string> {
  // Get account with RLS context
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
      console.error(`Failed to refresh token for account ${accountId}:`, error);
      throw new Error(`Token refresh failed: ${error.message}. User may need to re-authenticate.`);
    }
  }

  // Token is still valid, return it
  return decrypt(account.accessToken);
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

