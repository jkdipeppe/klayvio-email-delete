import { PrismaClient } from '@prisma/client';
import { KlaviyoClient } from './klaviyo-client';
import { ProfileScanner } from './profile-scanner';
import { getValidAccessToken } from '../utils/token-manager';
import { withAccountContext } from '../utils/rls';

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

      // Check if scheduled cleanup is enabled
      if (!account.scheduledCleanup?.isEnabled) {
        result.error = 'Scheduled cleanup not enabled for this account';
        return result;
      }

      // Check if account has rules
      if (account.rules.length === 0) {
        result.error = 'No active cleanup rules configured';
        return result;
      }

      // Create cleanup run record
      const cleanupRun = await withAccountContext(this.prisma, accountId, async () => {
        return await this.prisma.cleanupRun.create({
          data: {
            accountId,
            status: 'RUNNING',
          },
        });
      });

      try {
        // Get valid access token (auto-refreshes if needed)
        const accessToken = await getValidAccessToken(this.prisma, accountId);
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
              errorMessage: error.message,
            },
          });
        });

        result.error = error.message;
        // Don't re-throw - let cron job continue processing other accounts
        console.error(`Failed to process account ${accountId}:`, error.message);
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

      // Find all accounts due for cleanup
      const dueAccounts = await this.prisma.scheduledCleanup.findMany({
        where: {
          isEnabled: true,
          OR: [
            { nextRunAt: { lte: now } },
            { nextRunAt: null }, // First run
          ],
        },
        include: {
          account: true,
        },
      });

      console.log(`Found ${dueAccounts.length} accounts due for cleanup`);

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

