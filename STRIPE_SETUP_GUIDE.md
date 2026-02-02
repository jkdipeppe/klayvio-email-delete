# Stripe Subscription Setup Guide

## Overview

This guide walks you through setting up Stripe for subscription payments with two pricing tiers:
- **Basic**: $5/month (5 rules, manual only)
- **Pro**: $7/month (100 rules, automatic scheduling)

## Step 1: Create Stripe Account

1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete account verification
3. Get your API keys from Dashboard → Developers → API keys

## Step 2: Create Products and Prices in Stripe

### Create Basic Plan Product

1. Go to Stripe Dashboard → Products
2. Click "Add product"
3. Fill in:
   - **Name**: Basic Plan
   - **Description**: Up to 5 deletion rules, manual cleanup only
   - **Pricing**: $5.00 USD
   - **Billing period**: Monthly (recurring)
4. Click "Save product"
5. **Copy the Price ID** (starts with `price_...`)

### Create Pro Plan Product

1. Click "Add product" again
2. Fill in:
   - **Name**: Pro Plan
   - **Description**: Up to 100 deletion rules, automatic scheduling
   - **Pricing**: $7.00 USD
   - **Billing period**: Monthly (recurring)
3. Click "Save product"
4. **Copy the Price ID** (starts with `price_...`)

## Step 3: Set Up Webhook

### Create Webhook Endpoint

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. **Endpoint URL**: `https://your-backend.railway.app/api/subscription/webhook`
4. **Events to send**: Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Click "Add endpoint"
6. **Copy the Signing secret** (starts with `whsec_...`)

## Step 4: Configure Environment Variables

### Backend (Railway)

Add these to Railway → Variables:

```env
STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for testing)
STRIPE_BASIC_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Frontend (Vercel)

Add this to Vercel → Environment Variables:

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... (or pk_test_... for testing)
```

**Note**: Frontend doesn't need secret key (it's only used in backend)

## Step 5: Test the Integration

### Test Mode

1. Use **test API keys** (`sk_test_...` and `pk_test_...`)
2. Use Stripe test card: `4242 4242 4242 4242`
3. Any future expiry date, any CVC
4. Test the full flow:
   - Create checkout session
   - Complete payment
   - Verify webhook received
   - Check subscription created in database

### Production Mode

1. Switch to **live API keys** (`sk_live_...` and `pk_live_...`)
2. Update webhook URL to production backend
3. Test with real card (will charge $5 or $7)

## Step 6: Database Migration

Run the Prisma migration to add Subscription model:

```bash
cd backend
npx prisma migrate dev --name add_subscriptions
```

Or in production (Supabase):
1. Copy the migration SQL
2. Run in Supabase SQL Editor

## Step 7: Update RLS Policies

Add RLS policies for Subscription table:

```sql
-- Enable RLS on Subscription table
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own subscription" ON "Subscription";
DROP POLICY IF EXISTS "Users can update their own subscription" ON "Subscription";

-- Policy for Subscription table
CREATE POLICY "Users can view their own subscription"
  ON "Subscription" FOR SELECT
  USING (check_account_access("accountId"::text));

CREATE POLICY "Users can update their own subscription"
  ON "Subscription" FOR UPDATE
  USING (check_account_access("accountId"::text));
```

## Verification Checklist

- [ ] Stripe account created
- [ ] Basic plan product created ($5/month)
- [ ] Pro plan product created ($7/month)
- [ ] Webhook endpoint configured
- [ ] Webhook secret copied
- [ ] Environment variables set in Railway
- [ ] Environment variables set in Vercel
- [ ] Database migration run
- [ ] RLS policies added
- [ ] Test checkout flow works
- [ ] Test webhook receives events
- [ ] Subscription created in database

## Testing the Flow

1. **User clicks "Subscribe"** on pricing page
2. **Frontend calls** `/api/subscription/checkout`
3. **Backend creates** Stripe checkout session
4. **User redirected** to Stripe checkout
5. **User completes payment**
6. **Stripe sends webhook** to `/api/subscription/webhook`
7. **Backend creates** subscription in database
8. **User redirected** back to dashboard
9. **Dashboard shows** subscription status and limits

## Troubleshooting

### Webhook Not Receiving Events

- Check webhook URL is correct (production backend URL)
- Verify webhook secret matches
- Check Railway logs for webhook errors
- Test webhook in Stripe Dashboard → Webhooks → Send test webhook

### Subscription Not Created

- Check webhook logs in Stripe Dashboard
- Verify webhook secret is correct
- Check backend logs for errors
- Verify RLS policies allow webhook to create subscriptions

### Checkout Not Working

- Verify Stripe publishable key in frontend
- Check browser console for errors
- Verify backend URL is correct
- Check Stripe Dashboard → Logs for errors

## Security Notes

- **Never commit** Stripe keys to git
- Use **environment variables** for all keys
- Use **test keys** during development
- Switch to **live keys** only in production
- **Webhook secret** must match exactly

## Next Steps

After setup:
1. Test subscription flow end-to-end
2. Verify limits are enforced
3. Test subscription cancellation
4. Monitor Stripe Dashboard for payments
5. Set up email notifications in Stripe (optional)

