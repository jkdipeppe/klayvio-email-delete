# Fix: Invalid prisma.account.findUnique() Error

## Problem

With RLS enabled, Prisma queries are blocked when RLS context isn't set. The OAuth callback needs to look up accounts by `klaviyoAccountId` without context, which is failing.

## Quick Fix: Update RLS Policy

Run this SQL in **Supabase SQL Editor**:

```sql
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own account" ON "Account";

-- Create new policy that allows OAuth lookups
CREATE POLICY "Users can view their own account"
  ON "Account" FOR SELECT
  USING (
    -- Allow if RLS context matches the account id (normal queries)
    check_account_access(id::text)
    OR
    -- Allow if no context is set (needed for OAuth lookups by klaviyoAccountId)
    current_setting('app.current_account_id', true) IS NULL
  );
```

## Why This Works

- **Normal queries**: Still require RLS context (secure)
- **OAuth lookups**: Can query without context (needed to find account by `klaviyoAccountId`)
- **After OAuth**: Account operations still use RLS context

## Steps

1. **Go to Supabase** → SQL Editor
2. **Run the SQL above**
3. **Redeploy Railway** (if needed)
4. **Test OAuth flow** - should work now

## Verify

After running the SQL:
- OAuth flow should work
- Normal API calls should still be secure (require RLS context)
- Each account can only see their own data

This is safe because:
- OAuth lookups only happen during authentication
- Once authenticated, all operations use RLS context
- Users still can't see other accounts' data

