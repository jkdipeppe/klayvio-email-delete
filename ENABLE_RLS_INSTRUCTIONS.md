# Enable Row Level Security (RLS) in Supabase

## Quick Fix

If you see tables showing "unrestricted" in Supabase, you need to run the RLS SQL migration.

## Step-by-Step Instructions

### 1. Open Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New query**

### 2. Run the RLS Migration

Copy and paste the entire contents of `backend/prisma/migrations/enable_rls.sql` into the SQL editor, then click **Run**.

**OR** run this simplified version that ensures all tables have RLS enabled:

```sql
-- Enable Row Level Security on all tables
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CleanupRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeletionLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduledCleanup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CleanupRun" ENABLE ROW LEVEL SECURITY;

-- Create a function to check if the current user context matches an account ID
CREATE OR REPLACE FUNCTION check_account_access(account_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  current_account_id TEXT;
BEGIN
  BEGIN
    current_account_id := current_setting('app.current_account_id', true);
  EXCEPTION
    WHEN OTHERS THEN
      current_account_id := NULL;
  END;
  
  IF current_account_id IS NULL OR current_account_id = '' THEN
    RETURN false;
  END IF;
  
  RETURN current_account_id = account_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own account" ON "Account";
DROP POLICY IF EXISTS "Users can update their own account" ON "Account";
DROP POLICY IF EXISTS "Users can insert their own account" ON "Account";
DROP POLICY IF EXISTS "Users can view their own rules" ON "CleanupRule";
DROP POLICY IF EXISTS "Users can create rules for their own account" ON "CleanupRule";
DROP POLICY IF EXISTS "Users can update their own rules" ON "CleanupRule";
DROP POLICY IF EXISTS "Users can delete their own rules" ON "CleanupRule";
DROP POLICY IF EXISTS "Users can view their own deletion logs" ON "DeletionLog";
DROP POLICY IF EXISTS "Users can create logs for their own account" ON "DeletionLog";
DROP POLICY IF EXISTS "Users can view their own schedule" ON "ScheduledCleanup";
DROP POLICY IF EXISTS "Users can create their own schedule" ON "ScheduledCleanup";
DROP POLICY IF EXISTS "Users can update their own schedule" ON "ScheduledCleanup";
DROP POLICY IF EXISTS "Users can delete their own schedule" ON "ScheduledCleanup";
DROP POLICY IF EXISTS "Users can view their own cleanup runs" ON "CleanupRun";
DROP POLICY IF EXISTS "Users can create cleanup runs for their own account" ON "CleanupRun";
DROP POLICY IF EXISTS "Users can update cleanup runs for their own account" ON "CleanupRun";

-- Policy for Account table
CREATE POLICY "Users can view their own account"
  ON "Account" FOR SELECT
  USING (check_account_access(id::text));

CREATE POLICY "Users can update their own account"
  ON "Account" FOR UPDATE
  USING (check_account_access(id::text));

CREATE POLICY "Users can insert their own account"
  ON "Account" FOR INSERT
  WITH CHECK (
    check_account_access(id::text)
    OR current_setting('app.current_account_id', true) IS NULL
  );

-- Policy for CleanupRule table
CREATE POLICY "Users can view their own rules"
  ON "CleanupRule" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account".id = "CleanupRule"."accountId"
      AND check_account_access("Account".id::text)
    )
  );

CREATE POLICY "Users can create rules for their own account"
  ON "CleanupRule" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account".id = "CleanupRule"."accountId"
      AND check_account_access("Account".id::text)
    )
  );

CREATE POLICY "Users can update their own rules"
  ON "CleanupRule" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account".id = "CleanupRule"."accountId"
      AND check_account_access("Account".id::text)
    )
  );

CREATE POLICY "Users can delete their own rules"
  ON "CleanupRule" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account".id = "CleanupRule"."accountId"
      AND check_account_access("Account".id::text)
    )
  );

-- Policy for DeletionLog table
CREATE POLICY "Users can view their own deletion logs"
  ON "DeletionLog" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account".id = "DeletionLog"."accountId"
      AND check_account_access("Account".id::text)
    )
  );

CREATE POLICY "Users can create logs for their own account"
  ON "DeletionLog" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account".id = "DeletionLog"."accountId"
      AND check_account_access("Account".id::text)
    )
  );

-- Policy for ScheduledCleanup table
CREATE POLICY "Users can view their own schedule"
  ON "ScheduledCleanup" FOR SELECT
  USING (check_account_access("accountId"::text));

CREATE POLICY "Users can create their own schedule"
  ON "ScheduledCleanup" FOR INSERT
  WITH CHECK (check_account_access("accountId"::text));

CREATE POLICY "Users can update their own schedule"
  ON "ScheduledCleanup" FOR UPDATE
  USING (check_account_access("accountId"::text));

CREATE POLICY "Users can delete their own schedule"
  ON "ScheduledCleanup" FOR DELETE
  USING (check_account_access("accountId"::text));

-- Policy for CleanupRun table
CREATE POLICY "Users can view their own cleanup runs"
  ON "CleanupRun" FOR SELECT
  USING (check_account_access("accountId"::text));

CREATE POLICY "Users can create cleanup runs for their own account"
  ON "CleanupRun" FOR INSERT
  WITH CHECK (check_account_access("accountId"::text));

CREATE POLICY "Users can update cleanup runs for their own account"
  ON "CleanupRun" FOR UPDATE
  USING (check_account_access("accountId"::text));
```

### 3. Verify RLS is Enabled

1. Go to **Table Editor** in Supabase
2. Check each table - they should now show **RLS enabled** instead of **unrestricted**
3. You should see:
   - ✅ Account - RLS enabled
   - ✅ CleanupRule - RLS enabled
   - ✅ DeletionLog - RLS enabled
   - ✅ ScheduledCleanup - RLS enabled
   - ✅ CleanupRun - RLS enabled

### 4. Check Policies

1. Click on any table (e.g., `Account`)
2. Click the **Policies** tab
3. You should see policies listed for SELECT, INSERT, UPDATE, DELETE

## Troubleshooting

### If you get "policy already exists" errors:
The SQL above includes `DROP POLICY IF EXISTS` statements to handle this. If you still get errors, you can manually drop policies in Supabase:
1. Go to Table Editor → Select table → Policies tab
2. Delete existing policies
3. Re-run the SQL

### If tables still show "unrestricted":
1. Make sure you ran the `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` statements
2. Refresh the Supabase dashboard
3. Check that the SQL executed without errors

### If you see a 6th table:
Supabase may show `_prisma_migrations` table - this is a Prisma system table and doesn't need RLS (it's only used by Prisma migrations).

## What RLS Does

Row Level Security ensures that:
- Each user (Klaviyo account) can only see/modify their own data
- Even if someone gets direct database access, they can't see other users' data
- The application sets `app.current_account_id` before each database operation
- Policies check this context to allow/deny access

This is critical for multi-tenant security! 🔒

