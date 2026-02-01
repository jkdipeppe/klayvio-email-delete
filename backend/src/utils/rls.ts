import { PrismaClient } from '@prisma/client';

/**
 * Set the current account context for Row Level Security
 * This must be called before any database operations for a specific account
 */
export async function setAccountContext(prisma: PrismaClient, accountId: string): Promise<void> {
    // Use parameterized query to prevent SQL injection
    await prisma.$executeRawUnsafe(
        `SELECT set_config('app.current_account_id', $1::text, false)`,
        accountId
    );
}

/**
 * Clear the account context (for cleanup)
 */
export async function clearAccountContext(prisma: PrismaClient): Promise<void> {
    await prisma.$executeRawUnsafe(
        `SELECT set_config('app.current_account_id', '', false)`
    );
}

/**
 * Execute a database operation with RLS context
 */
export async function withAccountContext<T>(
    prisma: PrismaClient,
    accountId: string,
    operation: () => Promise<T>
): Promise<T> {
    try {
        await setAccountContext(prisma, accountId);
        return await operation();
    } finally {
        await clearAccountContext(prisma);
    }
}

