import { PrismaClient, Prisma } from '@prisma/client';
import { KlaviyoClient } from './klaviyo-client';
import { ProfileScanner } from './profile-scanner';
import { getValidAccessToken } from '../utils/token-manager';
import { withAccountContext } from '../utils/rls';
import { AuthenticationRequiredError, isAuthenticationRequiredError } from '../utils/auth-errors';

export interface CleanupResult {
  accountId: string;
  success: boolean;
  profilesFound: number;
  profilesDeleted: number;
  profilesFailed: number;
  error?: string;
}

export class ScheduledCleanupService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Process a single account's scheduled cleanup
   */
  async processAccount(accountId: string): Promise<CleanupResult> {
    const result: CleanupResult = {
      accountId,
      success: false,
      profilesFound: 0,
      profilesDeleted: 0,
      profilesFailed: 0,
    };

    try {
      // Get account with RLS context
      const account = await withAccountContext(this.prisma, accountId, async () => {
        return await this.prisma.account.findUnique({
          where: { id: accountId },
          include: {
            scheduledCleanup: true,
            rules: {
              where: { isActive: true },
            },
          },
        });
      });

      if (!account) {
        result.error = 'Account not found';
        return result;
      }

      // Validate and fix frequencyDays immediately after loading account
      if (account.scheduledCleanup) {
        const freqDays = Number(account.scheduledCleanup.frequencyDays);
        const isValid = !isNaN(freqDays) && (freqDays === 1 || freqDays === 7);

        if (!isValid) {
          console.warn(`Account ${accountId} loaded with invalid frequencyDays: ${account.scheduledCleanup.frequencyDays} (type: ${typeof account.scheduledCleanup.frequencyDays}), fixing to 7`);
          await withAccountContext(this.prisma, accountId, async () => {
            await this.prisma.scheduledCleanup.update({
              where: { accountId },
              data: { frequencyDays: 7 },
            });
          });
          // Update the account object to reflect the fix
          account.scheduledCleanup.frequencyDays = 7;
        }
      }

      // Create cleanup run record early so we can track all attempts, even if they fail validation
      const cleanupRun = await withAccountContext(this.prisma, accountId, async () => {
        return await this.prisma.cleanupRun.create({
          data: {
            accountId,
            status: 'RUNNING',
          },
        });
      });

      // Check if scheduled cleanup is enabled
      if (!account.scheduledCleanup?.isEnabled) {
        result.error = 'Scheduled cleanup not enabled for this account';
        // Update cleanup run as failed
        await withAccountContext(this.prisma, accountId, async () => {
          await this.prisma.cleanupRun.update({
            where: { id: cleanupRun.id },
            data: {
              status: 'FAILED',
              completedAt: new Date(),
              errorMessage: result.error,
            },
          });
        });
        return result;
      }

      // Check if account has rules
      if (account.rules.length === 0) {
        result.error = 'No active cleanup rules configured';
        // Update cleanup run as failed
        await withAccountContext(this.prisma, accountId, async () => {
          await this.prisma.cleanupRun.update({
            where: { id: cleanupRun.id },
            data: {
              status: 'FAILED',
              completedAt: new Date(),
              errorMessage: result.error,
            },
          });
        });
        return result;
      }

      try {
        // Get valid access token (auto-refreshes if needed)
        // Enable retry for cron jobs to handle race conditions with re-authentication
        const accessToken = await getValidAccessToken(this.prisma, accountId, true);
        const client = new KlaviyoClient(accessToken);
        const scanner = new ProfileScanner(client, this.prisma);

        // Scan for matching profiles
        const matches = await scanner.scanProfiles(accountId);
        result.profilesFound = matches.length;

        if (matches.length > 0) {
          // Delete matching profiles
          const deleteResult = await scanner.deleteMatchingProfiles(accountId, matches);
          result.profilesDeleted = deleteResult.deleted;
          result.profilesFailed = deleteResult.failed;
        }

        // Update cleanup run as completed
        await withAccountContext(this.prisma, accountId, async () => {
          await this.prisma.cleanupRun.update({
            where: { id: cleanupRun.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              profilesFound: result.profilesFound,
              profilesDeleted: result.profilesDeleted,
              profilesFailed: result.profilesFailed,
            },
          });
        });

        // Update scheduled cleanup next run time
        // Validate frequencyDays before updating - convert to number and validate
        let frequencyDays = Number(account.scheduledCleanup.frequencyDays);

        // Double-check and fix if invalid (defensive programming)
        if (isNaN(frequencyDays) || (frequencyDays !== 1 && frequencyDays !== 7)) {
          console.warn(`Invalid frequencyDays ${account.scheduledCleanup.frequencyDays} (type: ${typeof account.scheduledCleanup.frequencyDays}) for account ${accountId} in processAccount, fixing to 7`);
          frequencyDays = 7;
          // Update to valid default value
          await withAccountContext(this.prisma, accountId, async () => {
            await this.prisma.scheduledCleanup.update({
              where: { accountId },
              data: { frequencyDays: 7 },
            });
          });
        }

        // Update next run time with validated frequency
        await this.updateNextRunTime(accountId, frequencyDays);

        result.success = true;
      } catch (error: any) {
        // Check if this is an authentication error
        const isAuthError = isAuthenticationRequiredError(error);
        const errorMessage = isAuthError
          ? 'Authentication required: Please reconnect your Klaviyo account in the dashboard.'
          : error.message;

        // Update cleanup run as failed
        await withAccountContext(this.prisma, accountId, async () => {
          await this.prisma.cleanupRun.update({
            where: { id: cleanupRun.id },
            data: {
              status: 'FAILED',
              completedAt: new Date(),
              profilesFound: result.profilesFound,
              profilesDeleted: result.profilesDeleted,
              profilesFailed: result.profilesFailed,
              errorMessage: errorMessage,
            },
          });
        });

        result.error = errorMessage;
        // Don't re-throw - let cron job continue processing other accounts
        if (isAuthError) {
          console.error(`Authentication required for account ${accountId}: User needs to reconnect Klaviyo account`);
        } else {
          console.error(`Failed to process account ${accountId}:`, error.message);
        }
      }
    } catch (error: any) {
      console.error(`Error processing account ${accountId}:`, error);
      result.error = error.message || 'Unknown error';
    }

    return result;
  }

  /**
   * Process all accounts that are due for cleanup
   */
  async processDueAccounts(): Promise<CleanupResult[]> {
    try {
      const now = new Date();
      const results: CleanupResult[] = [];

      // Find all accounts due for cleanup using raw SQL to avoid prepared statement conflicts
      // with connection pooling (Supabase uses port 6543 for pooling)
      // NOTE: This query works because RLS policy allows queries when no account context is set
      // (for system/cron operations). See enable_rls.sql for the policy.
      // Using $queryRawUnsafe to completely bypass prepared statements
      const nowISO = now.toISOString();
      const dueAccountsRaw = await this.prisma.$queryRawUnsafe(`
        SELECT 
          sc.id,
          sc."accountId",
          sc."isEnabled",
          sc."frequencyDays",
          sc."lastRunAt",
          sc."nextRunAt",
          a.id as account_id,
          a."klaviyoAccountId" as account_klaviyoAccountId
        FROM "ScheduledCleanup" sc
        INNER JOIN "Account" a ON sc."accountId" = a.id
        WHERE sc."isEnabled" = true
        AND (sc."nextRunAt" <= '${nowISO}'::timestamp OR sc."nextRunAt" IS NULL)
      `) as Array<{
        id: string;
        accountId: string;
        isEnabled: boolean;
        frequencyDays: number;
        lastRunAt: Date | null;
        nextRunAt: Date | null;
        account_id: string;
        account_klaviyoAccountId: string;
      }>;

      // Transform raw results to match expected structure
      const dueAccounts = dueAccountsRaw.map(row => ({
        id: row.id,
        accountId: row.accountId,
        isEnabled: row.isEnabled,
        frequencyDays: row.frequencyDays,
        lastRunAt: row.lastRunAt,
        nextRunAt: row.nextRunAt,
        account: {
          id: row.account_id,
          klaviyoAccountId: row.account_klaviyoAccountId,
        },
      }));

      console.log(`Found ${dueAccounts.length} accounts due for cleanup`);

      if (dueAccounts.length === 0) {
        console.log('No accounts found due for cleanup.');
        console.log('This could mean:');
        console.log('  1. No accounts have scheduled cleanup enabled');
        console.log('  2. All accounts have nextRunAt set to a future date');
        console.log('  3. No ScheduledCleanup records exist in the database');
        // Use raw SQL to avoid prepared statement conflicts with connection pooling
        try {
          const allSchedulesCount = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint as count FROM "ScheduledCleanup"
          `;
          const enabledCount = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint as count FROM "ScheduledCleanup" WHERE "isEnabled" = true
          `;
          console.log(`Total ScheduledCleanup records: ${allSchedulesCount[0]?.count || 0}`);
          console.log(`Enabled ScheduledCleanup records: ${enabledCount[0]?.count || 0}`);
        } catch (debugError: any) {
          console.error('Could not fetch debug info:', debugError.message);
        }
      }

      // Process each account sequentially (to respect rate limits)
      for (const scheduledCleanup of dueAccounts) {
        try {
          // Validate and fix frequencyDays before processing
          // Convert to number and check for null/undefined
          const freqDays = Number(scheduledCleanup.frequencyDays);
          const isValid = !isNaN(freqDays) && (freqDays === 1 || freqDays === 7);

          if (!isValid) {
            console.warn(`Account ${scheduledCleanup.accountId} has invalid frequencyDays: ${scheduledCleanup.frequencyDays} (type: ${typeof scheduledCleanup.frequencyDays}), fixing to 7`);
            await withAccountContext(this.prisma, scheduledCleanup.accountId, async () => {
              await this.prisma.scheduledCleanup.update({
                where: { accountId: scheduledCleanup.accountId },
                data: { frequencyDays: 7 },
              });
            });
          }

          const result = await this.processAccount(scheduledCleanup.accountId);
          results.push(result);

          // Small delay between accounts to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error: any) {
          console.error(`Failed to process account ${scheduledCleanup.accountId}:`, error);
          console.error(`Error details:`, {
            message: error.message,
            stack: error.stack,
            accountId: scheduledCleanup.accountId,
          });
          results.push({
            accountId: scheduledCleanup.accountId,
            success: false,
            profilesFound: 0,
            profilesDeleted: 0,
            profilesFailed: 0,
            error: error.message || 'Unknown error',
          });
        }
      }

      return results;
    } catch (error: any) {
      console.error('Fatal error in processDueAccounts:', error);
      console.error('Error stack:', error.stack);
      // Return empty results array instead of throwing - let the cron endpoint handle the error
      return [{
        accountId: 'unknown',
        success: false,
        profilesFound: 0,
        profilesDeleted: 0,
        profilesFailed: 0,
        error: error.message || 'Fatal error processing accounts',
      }];
    }
  }

  /**
   * Update next run time based on frequency
   */
  async updateNextRunTime(accountId: string, frequencyDays: number): Promise<void> {
    // Validate frequencyDays - convert to number and check
    let validFrequencyDays = Number(frequencyDays);

    // If invalid (NaN, null, undefined, or not 1 or 7), default to 7
    if (isNaN(validFrequencyDays) || (validFrequencyDays !== 1 && validFrequencyDays !== 7)) {
      console.warn(`updateNextRunTime called with invalid frequencyDays ${frequencyDays} (type: ${typeof frequencyDays}) for account ${accountId}, defaulting to 7`);
      validFrequencyDays = 7;
      // Also update the database to fix it
      await withAccountContext(this.prisma, accountId, async () => {
        await this.prisma.scheduledCleanup.update({
          where: { accountId },
          data: { frequencyDays: 7 },
        });
      });
    }

    const now = new Date();
    const nextRunAt = new Date(now.getTime() + validFrequencyDays * 24 * 60 * 60 * 1000);

    await withAccountContext(this.prisma, accountId, async () => {
      await this.prisma.scheduledCleanup.update({
        where: { accountId },
        data: {
          lastRunAt: now,
          nextRunAt,
        },
      });
    });
  }

  /**
   * Calculate next run time based on frequency
   */
  calculateNextRunTime(frequencyDays: number): Date {
    // Validate and normalize frequencyDays
    let validFrequencyDays = Number(frequencyDays);
    if (isNaN(validFrequencyDays) || (validFrequencyDays !== 1 && validFrequencyDays !== 7)) {
      console.warn(`calculateNextRunTime called with invalid frequencyDays ${frequencyDays}, defaulting to 7`);
      validFrequencyDays = 7;
    }

    const now = new Date();
    return new Date(now.getTime() + validFrequencyDays * 24 * 60 * 60 * 1000);
  }
}

