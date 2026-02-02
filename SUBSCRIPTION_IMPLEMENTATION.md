# Subscription Pricing Implementation

## Pricing Tiers

### Basic Plan - $5/month
- ✅ Max 5 deletion rules
- ❌ Manual cleanup only (no automatic scheduling)
- ✅ Unlimited manual runs

### Pro Plan - $7/month  
- ✅ Max 100 deletion rules
- ✅ Automatic scheduling (daily/weekly)
- ✅ Unlimited manual runs

## Implementation Plan

### Phase 1: Database Schema
1. Add `Subscription` model to Prisma schema
2. Add subscription tier enum
3. Create migration

### Phase 2: Stripe Integration
1. Install Stripe SDK
2. Create Stripe products/prices
3. Add subscription routes (checkout, webhook, status)
4. Handle subscription events

### Phase 3: Backend Validation
1. Add subscription checks to rule creation
2. Add subscription checks to schedule enablement
3. Create subscription utility functions

### Phase 4: Frontend
1. Create pricing page
2. Add subscription management UI
3. Show limits and upgrade prompts
4. Update dashboard with subscription status

Let's start implementing!

