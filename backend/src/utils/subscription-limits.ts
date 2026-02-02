import { PrismaClient, SubscriptionTier } from '@prisma/client';

export interface SubscriptionLimits {
    maxRules: number;
    allowScheduling: boolean;
    maxProfilesPerDeletion: number | null; // null means unlimited
}

/**
 * Get subscription limits based on tier
 */
export function getSubscriptionLimits(tier: SubscriptionTier | null): SubscriptionLimits {
    switch (tier) {
        case SubscriptionTier.FREE:
            return {
                maxRules: 1,
                allowScheduling: false,
                maxProfilesPerDeletion: 3,
            };
        case SubscriptionTier.BASIC:
            return {
                maxRules: 5,
                allowScheduling: false,
                maxProfilesPerDeletion: null, // Unlimited
            };
        case SubscriptionTier.PRO:
            return {
                maxRules: 100,
                allowScheduling: true,
                maxProfilesPerDeletion: null, // Unlimited
            };
        default:
            // No subscription - treat as FREE tier
            return {
                maxRules: 1,
                allowScheduling: false,
                maxProfilesPerDeletion: 3,
            };
    }
}

/**
 * Check if account can create more rules
 */
export async function canCreateRule(
    prisma: PrismaClient,
    accountId: string
): Promise<{ allowed: boolean; currentCount: number; maxRules: number; tier: SubscriptionTier | null }> {
    // Get account's subscription
    const account = await prisma.account.findUnique({
        where: { id: accountId },
        include: { subscription: true },
    });

    if (!account) {
        throw new Error('Account not found');
    }

    const tier = account.subscription?.tier || null;
    const limits = getSubscriptionLimits(tier);

    // Count current rules
    const currentCount = await prisma.cleanupRule.count({
        where: { accountId },
    });

    return {
        allowed: currentCount < limits.maxRules,
        currentCount,
        maxRules: limits.maxRules,
        tier,
    };
}

/**
 * Check if account can enable scheduling
 */
export async function canEnableScheduling(
    prisma: PrismaClient,
    accountId: string
): Promise<{ allowed: boolean; tier: SubscriptionTier | null }> {
    const account = await prisma.account.findUnique({
        where: { id: accountId },
        include: { subscription: true },
    });

    if (!account) {
        throw new Error('Account not found');
    }

    const tier = account.subscription?.tier || null;
    const limits = getSubscriptionLimits(tier);

    return {
        allowed: limits.allowScheduling,
        tier,
    };
}

/**
 * Get subscription info for account
 */
export async function getSubscriptionInfo(prisma: PrismaClient, accountId: string) {
    const account = await prisma.account.findUnique({
        where: { id: accountId },
        include: {
            subscription: true,
            rules: true,
        },
    });

    if (!account) {
        throw new Error('Account not found');
    }

    const tier = account.subscription?.tier || null;
    const limits = getSubscriptionLimits(tier);
    const currentRuleCount = account.rules.length;

    return {
        tier,
        status: account.subscription?.status || null,
        limits,
        currentRuleCount,
        canCreateMoreRules: currentRuleCount < limits.maxRules,
        canSchedule: limits.allowScheduling,
        maxProfilesPerDeletion: limits.maxProfilesPerDeletion,
        subscription: account.subscription,
    };
}

