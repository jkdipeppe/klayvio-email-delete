# Subscription Pricing Implementation Plan

## Pricing Tiers

### Tier 1: Basic ($5/month)
- **Max Rules**: 5 deletion rules
- **Automatic Scheduling**: ❌ Disabled (manual runs only)
- **Features**: Manual cleanup only

### Tier 2: Pro ($7/month)
- **Max Rules**: 100 deletion rules
- **Automatic Scheduling**: ✅ Enabled (daily/weekly)
- **Features**: Full automation

## Implementation Architecture

### 1. Database Schema Changes

Add new models:
- `Subscription` - Track user subscriptions
- `Payment` - Track payment history (optional, for records)

### 2. Payment Processing

**Recommended: Stripe**
- Most popular and reliable
- Handles subscriptions automatically
- Webhook support for payment events
- Good documentation

### 3. Backend Changes

**New Routes:**
- `POST /api/subscription/create-checkout` - Create Stripe checkout session
- `POST /api/subscription/webhook` - Handle Stripe webhooks
- `GET /api/subscription/:accountId` - Get subscription status
- `POST /api/subscription/cancel` - Cancel subscription

**Modified Routes:**
- `POST /api/rules/:accountId` - Check rule limit before creating
- `POST /api/schedule/:accountId` - Check subscription tier before enabling
- `GET /api/rules/:accountId` - Return rule count and limit

### 4. Frontend Changes

**New Pages:**
- `/pricing` - Pricing page with tier comparison
- `/subscription` - Subscription management page

**Modified Components:**
- Dashboard - Show subscription status, enforce limits
- Rule creation - Show limit warnings
- Schedule toggle - Disable for Basic tier

### 5. Validation & Enforcement

- Check subscription status before rule creation
- Enforce rule limits
- Disable scheduling for Basic tier
- Show upgrade prompts when limits reached

## Implementation Steps

1. **Database Schema** - Add Subscription model
2. **Stripe Setup** - Configure Stripe account and products
3. **Backend API** - Subscription routes and validation
4. **Frontend UI** - Pricing page and subscription management
5. **Enforcement** - Add limits to existing routes
6. **Testing** - Test subscription flow end-to-end

## Stripe Products Setup

Create two products in Stripe:
1. **Basic Plan**: $5/month recurring
2. **Pro Plan**: $7/month recurring

## Environment Variables Needed

```
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BASIC_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
```

## Next Steps

Would you like me to:
1. Start with database schema changes?
2. Set up Stripe integration?
3. Create the pricing page first?

Let me know and I'll implement it step by step!

