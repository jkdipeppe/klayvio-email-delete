import { PrismaClient, SubscriptionTier } from '@prisma/client';

export interface SubscriptionLimits {
  maxRules: number;
  allowScheduling: boolean;
}

/**
 * Get subscription limits based on tier
 */
export function getSubscriptionLimits(tier: SubscriptionTier | null): SubscriptionLimits {
  switch (tier) {
    case SubscriptionTier.BASIC:
      return {
        maxRules: 5,
        allowScheduling: false,
      };
    case SubscriptionTier.PRO:
      return {
        maxRules: 100,
        allowScheduling: true,
      };
    default:
      // Free tier (no subscription) - same as Basic but encourage upgrade
      return {
        maxRules: 5,
        allowScheduling: false,
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
    subscription: account.subscription,
  };
}

