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
        await this.updateNextRunTime(accountId, account.scheduledCleanup.frequencyDays);

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
        throw error;
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
        const result = await this.processAccount(scheduledCleanup.accountId);
        results.push(result);
        
        // Small delay between accounts to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(`Failed to process account ${scheduledCleanup.accountId}:`, error);
        results.push({
          accountId: scheduledCleanup.accountId,
          success: false,
          profilesFound: 0,
          profilesDeleted: 0,
          profilesFailed: 0,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Update next run time based on frequency
   */
  async updateNextRunTime(accountId: string, frequencyDays: number): Promise<void> {
    const now = new Date();
    const nextRunAt = new Date(now.getTime() + frequencyDays * 24 * 60 * 60 * 1000);

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
    const now = new Date();
    return new Date(now.getTime() + frequencyDays * 24 * 60 * 60 * 1000);
  }
}

