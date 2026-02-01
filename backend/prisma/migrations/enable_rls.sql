-- Enable Row Level Security on all tables
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CleanupRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeletionLog" ENABLE ROW LEVEL SECURITY;

-- Create a function to check if the current user context matches an account ID
-- This will be set by the application using set_config
CREATE OR REPLACE FUNCTION check_account_access(account_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  current_account_id TEXT;
BEGIN
  -- Get the current session's account_id (returns NULL if not set)
  BEGIN
    current_account_id := current_setting('app.current_account_id', true);
  EXCEPTION
    WHEN OTHERS THEN
      current_account_id := NULL;
  END;
  
  -- If not set, deny access (fail-safe)
  IF current_account_id IS NULL OR current_account_id = '' THEN
    RETURN false;
  END IF;
  
  -- Check if it matches (compare as text)
  RETURN current_account_id = account_id;
EXCEPTION
  WHEN OTHERS THEN
    -- If there's any error, deny access
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own account" ON "Account";
DROP POLICY IF EXISTS "Users can update their own account" ON "Account";
DROP POLICY IF EXISTS "Users can insert their own account" ON "Account";

-- Policy for Account table: Users can only see/update their own account
-- Allow lookups without context for OAuth flow (when looking up by klaviyoAccountId)
CREATE POLICY "Users can view their own account"
  ON "Account"
  FOR SELECT
  USING (
    -- Allow if RLS context matches the account id
    check_account_access(id::text)
    OR
    -- Allow if no context is set (needed for OAuth lookups by klaviyoAccountId)
    current_setting('app.current_account_id', true) IS NULL
  );

CREATE POLICY "Users can update their own account"
  ON "Account"
  FOR UPDATE
  USING (check_account_access(id::text));

-- Allow account creation during OAuth (account doesn't exist yet, so we can't check access)
-- This is safe because the accountId in the context will match the created account's id
CREATE POLICY "Users can insert their own account"
  ON "Account"
  FOR INSERT
  WITH CHECK (
    -- Allow if context matches the account being created, or if context is not set (OAuth flow)
    check_account_access(id::text)
    OR current_setting('app.current_account_id', true) IS NULL
  );

-- Drop existing CleanupRule policies
DROP POLICY IF EXISTS "Users can view their own rules" ON "CleanupRule";
DROP POLICY IF EXISTS "Users can create rules for their own account" ON "CleanupRule";
DROP POLICY IF EXISTS "Users can update their own rules" ON "CleanupRule";
DROP POLICY IF EXISTS "Users can delete their own rules" ON "CleanupRule";

-- Policy for CleanupRule table: Users can only access rules for their own account
CREATE POLICY "Users can view their own rules"
  ON "CleanupRule"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account".id = "CleanupRule"."accountId"
      AND check_account_access("Account".id::text)
    )
  );

CREATE POLICY "Users can create rules for their own account"
  ON "CleanupRule"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account".id = "CleanupRule"."accountId"
      AND check_account_access("Account".id::text)
    )
  );

CREATE POLICY "Users can update their own rules"
  ON "CleanupRule"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account".id = "CleanupRule"."accountId"
      AND check_account_access("Account".id::text)
    )
  );

CREATE POLICY "Users can delete their own rules"
  ON "CleanupRule"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account".id = "CleanupRule"."accountId"
      AND check_account_access("Account".id::text)
    )
  );

-- Drop existing DeletionLog policies
DROP POLICY IF EXISTS "Users can view their own deletion logs" ON "DeletionLog";
DROP POLICY IF EXISTS "Users can create logs for their own account" ON "DeletionLog";

-- Policy for DeletionLog table: Users can only access logs for their own account
CREATE POLICY "Users can view their own deletion logs"
  ON "DeletionLog"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account".id = "DeletionLog"."accountId"
      AND check_account_access("Account".id::text)
    )
  );

CREATE POLICY "Users can create logs for their own account"
  ON "DeletionLog"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account".id = "DeletionLog"."accountId"
      AND check_account_access("Account".id::text)
    )
  );

-- Enable RLS on ScheduledCleanup table
ALTER TABLE "ScheduledCleanup" ENABLE ROW LEVEL SECURITY;

-- Drop existing ScheduledCleanup policies
DROP POLICY IF EXISTS "Users can view their own schedule" ON "ScheduledCleanup";
DROP POLICY IF EXISTS "Users can create their own schedule" ON "ScheduledCleanup";
DROP POLICY IF EXISTS "Users can update their own schedule" ON "ScheduledCleanup";
DROP POLICY IF EXISTS "Users can delete their own schedule" ON "ScheduledCleanup";

-- Policy for ScheduledCleanup table
CREATE POLICY "Users can view their own schedule"
  ON "ScheduledCleanup"
  FOR SELECT
  USING (check_account_access("accountId"::text));

CREATE POLICY "Users can create their own schedule"
  ON "ScheduledCleanup"
  FOR INSERT
  WITH CHECK (check_account_access("accountId"::text));

CREATE POLICY "Users can update their own schedule"
  ON "ScheduledCleanup"
  FOR UPDATE
  USING (check_account_access("accountId"::text));

CREATE POLICY "Users can delete their own schedule"
  ON "ScheduledCleanup"
  FOR DELETE
  USING (check_account_access("accountId"::text));

-- Enable RLS on CleanupRun table
ALTER TABLE "CleanupRun" ENABLE ROW LEVEL SECURITY;

-- Drop existing CleanupRun policies
DROP POLICY IF EXISTS "Users can view their own cleanup runs" ON "CleanupRun";
DROP POLICY IF EXISTS "Users can create cleanup runs for their own account" ON "CleanupRun";
DROP POLICY IF EXISTS "Users can update cleanup runs for their own account" ON "CleanupRun";

-- Policy for CleanupRun table
-- CleanupRun has a direct accountId field, so we can check it directly
CREATE POLICY "Users can view their own cleanup runs"
  ON "CleanupRun"
  FOR SELECT
  USING (check_account_access("accountId"::text));

CREATE POLICY "Users can create cleanup runs for their own account"
  ON "CleanupRun"
  FOR INSERT
  WITH CHECK (check_account_access("accountId"::text));

CREATE POLICY "Users can update cleanup runs for their own account"
  ON "CleanupRun"
  FOR UPDATE
  USING (check_account_access("accountId"::text));

