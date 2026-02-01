# Row Level Security (RLS) Setup Guide

This guide explains how to enable Row Level Security (RLS) in Supabase to ensure users can only access their own data.

## Overview

RLS ensures that even if there's a bug in the application code, users cannot access or modify other users' data at the database level. This is a defense-in-depth security measure.

## Prerequisites

- Supabase project with PostgreSQL database
- Database migrations already run (Prisma schema applied)

## Step 1: Enable RLS in Supabase

### Option A: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `prisma/migrations/enable_rls.sql`
4. Click **Run** to execute the SQL

### Option B: Using psql

```bash
# Connect to your Supabase database
psql "your_supabase_connection_string"

# Run the migration
\i prisma/migrations/enable_rls.sql
```

## Step 2: Verify RLS is Enabled

Run this query in Supabase SQL Editor:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('Account', 'CleanupRule', 'DeletionLog');
```

All tables should show `rowsecurity = true`.

## Step 3: Test RLS Policies

### Test 1: Verify users can only see their own accounts

```sql
-- Set account context (simulating user with account ID)
SELECT set_config('app.current_account_id', 'your-account-id-here', false);

-- Try to query accounts - should only see the one matching the context
SELECT * FROM "Account";
```

### Test 2: Verify users cannot access other accounts' rules

```sql
-- Set context to account A
SELECT set_config('app.current_account_id', 'account-a-id', false);

-- Try to query rules - should only see account A's rules
SELECT * FROM "CleanupRule";

-- Try to set context to account B and query - should see different rules
SELECT set_config('app.current_account_id', 'account-b-id', false);
SELECT * FROM "CleanupRule";
```

## How It Works

1. **Application sets context**: Before any database operation, the app calls `setAccountContext()` which sets a PostgreSQL session variable
2. **RLS policies check context**: Each RLS policy uses the `check_account_access()` function to verify the current session's account ID matches the row's account ID
3. **Database enforces security**: PostgreSQL automatically filters rows based on the policies, even if application code has bugs

## Important Notes

### Connection Pooling

If you're using connection pooling (which Supabase does by default), you need to ensure each request gets its own connection or the context is set per-request. The `withAccountContext()` helper function handles this.

### Service Role Key

If you need to bypass RLS for admin operations, you can use Supabase's service role key. However, **never use the service role key in your application code** - only use it for:
- Database migrations
- Admin operations
- One-time data fixes

### Testing

When testing locally, RLS will be enforced. Make sure your test data includes proper account IDs and that you're setting the context correctly.

## Troubleshooting

### "Permission denied" errors

- Make sure RLS is enabled: `ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;`
- Verify the `check_account_access()` function exists
- Check that you're setting the account context before queries

### Queries returning no results

- Verify the account context is set correctly
- Check that the account ID matches the data you're querying
- Ensure RLS policies are created correctly

### Policies not working

- Verify policies exist: `SELECT * FROM pg_policies WHERE tablename = 'Account';`
- Check policy definitions match your use case
- Ensure the `check_account_access()` function is working correctly

## Security Best Practices

1. **Always use RLS context**: Never bypass RLS unless absolutely necessary
2. **Validate account ownership**: Always verify the account exists before setting context
3. **Use transactions**: Wrap related operations in transactions to ensure consistency
4. **Monitor access**: Set up logging to monitor database access patterns
5. **Regular audits**: Periodically review RLS policies to ensure they're still correct

## Migration from Non-RLS Setup

If you're adding RLS to an existing database:

1. **Backup your database** first!
2. Enable RLS on tables
3. Create policies
4. Test thoroughly with existing data
5. Deploy application code that uses RLS context

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

