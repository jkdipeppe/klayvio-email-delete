-- Add FREE tier to SubscriptionTier enum
ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'FREE';

