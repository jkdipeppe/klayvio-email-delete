# Fix: Invalid prisma.account.findUnique() Error

## Problem

With RLS enabled, Prisma queries return 0 rows (or errors) if RLS context isn't set. The OAuth callback tries to look up accounts by `klaviyoAccountId` without RLS context, which fails.

## Root Cause

1. **RLS blocks queries without context**: All SELECT queries need RLS context set
2. **OAuth flow doesn't have account ID yet**: During OAuth, we look up by `klaviyoAccountId`, but RLS checks by `id`
3. **Prisma Client might not be generated**: Railway might not be running `prisma generate` during build

## Solutions

### Solution 1: Fix RLS Policy for OAuth Lookups

The Account SELECT policy needs to allow lookups by `klaviyoAccountId` during OAuth. Update the RLS policy:

```sql
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own account" ON "Account";

-- Create new policy that allows lookups by klaviyoAccountId OR by id with context
CREATE POLICY "Users can view their own account"
  ON "Account" FOR SELECT
  USING (
    -- Allow if RLS context matches the account id
    check_account_access(id::text)
    OR
    -- Allow if no context is set (for OAuth lookups by klaviyoAccountId)
    current_setting('app.current_account_id', true) IS NULL
  );
```

### Solution 2: Ensure Prisma Client is Generated

Railway needs to run `prisma generate` during build. Check `package.json`:

```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "tsc && prisma generate"
  }
}
```

### Solution 3: Wrap OAuth Lookup with Temporary Context

If we can't modify RLS policy, we need to handle OAuth differently. But this is complex.

## Quick Fix: Update RLS Policy

Run this SQL in Supabase:

```sql
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own account" ON "Account";

-- Create new policy that allows OAuth lookups
CREATE POLICY "Users can view their own account"
  ON "Account" FOR SELECT
  USING (
    -- Allow if RLS context matches
    check_account_access(id::text)
    OR
    -- Allow if no context is set (for OAuth flow)
    current_setting('app.current_account_id', true) IS NULL
  );
```

This allows:
- Normal queries with RLS context (secure)
- OAuth lookups without context (needed for initial account creation)

## Verify Fix

1. Run the SQL above in Supabase
2. Redeploy Railway backend
3. Test OAuth flow - should work now
4. Test normal queries - should still be secure

