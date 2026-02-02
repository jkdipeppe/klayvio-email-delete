# Supabase Migration Guide - Adding FREE Tier

## Overview
This guide explains how to add the FREE tier to your `SubscriptionTier` enum in Supabase.

## Method 1: Supabase SQL Editor (Recommended - Easiest)

### Steps:

1. **Log into Supabase Dashboard**
   - Go to [supabase.com](https://supabase.com)
   - Select your project

2. **Open SQL Editor**
   - Click on **SQL Editor** in the left sidebar
   - Click **New Query**

3. **Run the Migration SQL**
   - Copy and paste the following SQL:
   ```sql
   -- Add FREE tier to SubscriptionTier enum
   ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'FREE';
   ```

4. **Execute**
   - Click **Run** (or press `Ctrl/Cmd + Enter`)
   - You should see "Success. No rows returned"

5. **Verify**
   - Run this query to verify the enum values:
   ```sql
   SELECT unnest(enum_range(NULL::"SubscriptionTier"));
   ```
   - You should see: `FREE`, `BASIC`, `PRO`

## Method 2: Prisma Migrate Deploy (If using Prisma CLI)

### Prerequisites:
- `DATABASE_URL` environment variable set to your Supabase connection string
- Prisma CLI installed (`npm install -g prisma` or use `npx`)

### Steps:

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Generate Prisma Client** (to sync with schema)
   ```bash
   npx prisma generate
   ```

3. **Create a proper Prisma migration** (if not already created)
   ```bash
   npx prisma migrate dev --create-only --name add_free_tier
   ```
   
   This will create a migration file in `prisma/migrations/` directory.

4. **Apply the migration to Supabase**
   ```bash
   npx prisma migrate deploy
   ```
   
   This will apply all pending migrations to your Supabase database.

## Method 3: Railway CLI (If deployed on Railway)

If your backend is deployed on Railway:

```bash
railway run npx prisma migrate deploy
```

This will run migrations against your production Supabase database using Railway's environment.

## Verification

After running the migration, verify it worked:

### Option A: Supabase SQL Editor
```sql
-- Check enum values
SELECT unnest(enum_range(NULL::"SubscriptionTier"));

-- Check if you can create a subscription with FREE tier (test query)
SELECT 'FREE'::"SubscriptionTier" as test_tier;
```

### Option B: Via Your Application
1. Start your backend server
2. Check that users without subscriptions are treated as FREE tier
3. Verify the limits (1 rule, max 3 profiles per deletion) are enforced

## Troubleshooting

### Error: "enum value already exists"
If you see this error, the FREE tier is already added. You can verify with:
```sql
SELECT unnest(enum_range(NULL::"SubscriptionTier"));
```

### Error: "cannot add new value to enum type inside a transaction block"
This happens if you're trying to add the enum value inside a transaction. The SQL statement should be run standalone (not wrapped in BEGIN/COMMIT).

### Error: "relation does not exist"
Make sure you're connected to the correct Supabase project and database.

## Next Steps

After the migration is complete:

1. **Regenerate Prisma Client** (if using Prisma):
   ```bash
   cd backend
   npx prisma generate
   ```

2. **Restart your backend server** to pick up the new enum value

3. **Test the free tier**:
   - Create a new account (or use an existing one without subscription)
   - Verify it's treated as FREE tier
   - Test the 1 rule limit
   - Test the 3 profile deletion limit

## Notes

- The `IF NOT EXISTS` clause prevents errors if the value already exists
- This is a non-destructive change - existing subscriptions won't be affected
- Users without subscriptions will automatically be treated as FREE tier
- The migration is backward compatible with existing data

