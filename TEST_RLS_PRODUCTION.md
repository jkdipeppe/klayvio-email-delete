# Testing RLS in Production

## Overview

This guide helps you verify that Row Level Security (RLS) is working correctly in production, ensuring multi-tenant isolation.

## Prerequisites

- ✅ RLS SQL migration has been run successfully
- ✅ All tables show "RLS enabled" in Supabase
- ✅ Production app is deployed and accessible

---

## Test 1: Basic Functionality Test

### Goal: Verify the app works normally with RLS enabled

1. **Visit your production frontend URL**
   ```
   https://your-frontend-url.vercel.app
   ```

2. **Connect with Klaviyo**
   - Click "Connect with Klaviyo"
   - Complete OAuth flow
   - Should redirect to dashboard successfully

3. **Create a cleanup rule**
   - Add a test rule (e.g., email contains "test")
   - Should save successfully

4. **Run a preview scan**
   - Click "Preview Scan"
   - Should return results (or empty if no matches)

5. **Check scheduled cleanup**
   - Enable scheduled cleanup
   - Set frequency
   - Should save successfully

**✅ Success Criteria**: All basic operations work without errors

---

## Test 2: Multi-Tenant Isolation Test

### Goal: Verify users can only see their own data

**Setup**: You'll need at least 2 different Klaviyo accounts

### Test Steps:

1. **Account A Setup**
   - Connect Account A to your app
   - Create 2-3 cleanup rules
   - Run a preview scan
   - Enable scheduled cleanup
   - Note the Account ID from the URL: `?accountId=XXXX-XXXX-XXXX`

2. **Account B Setup**
   - Use a different browser/incognito window
   - Connect Account B (different Klaviyo account)
   - Create 1 cleanup rule
   - Note the Account ID: `?accountId=YYYY-YYYY-YYYY`

3. **Verify Isolation**
   - In Account A's dashboard, you should only see Account A's rules
   - In Account B's dashboard, you should only see Account B's rules
   - Account A should NOT see Account B's rules
   - Account B should NOT see Account A's rules

**✅ Success Criteria**: Each account only sees its own data

---

## Test 3: Direct Database Access Test

### Goal: Verify RLS prevents unauthorized access at the database level

### Option A: Using Supabase SQL Editor

1. **Get Account IDs**
   - Note Account A's ID: `account-id-a`
   - Note Account B's ID: `account-id-b`

2. **Test Query Without Context**
   ```sql
   -- This should return 0 rows (RLS blocks access)
   SELECT * FROM "Account";
   SELECT * FROM "CleanupRule";
   SELECT * FROM "DeletionLog";
   SELECT * FROM "ScheduledCleanup";
   SELECT * FROM "CleanupRun";
   ```
   **Expected**: 0 rows (RLS is blocking)

3. **Test Query With Context (Account A)**
   ```sql
   -- Set context for Account A
   SET app.current_account_id = 'account-id-a';
   
   -- Now query should return Account A's data only
   SELECT * FROM "Account" WHERE id = 'account-id-a';
   SELECT * FROM "CleanupRule" WHERE "accountId" = 'account-id-a';
   ```
   **Expected**: Only Account A's data

4. **Test Query With Wrong Context**
   ```sql
   -- Set context for Account A
   SET app.current_account_id = 'account-id-a';
   
   -- Try to access Account B's data
   SELECT * FROM "Account" WHERE id = 'account-id-b';
   SELECT * FROM "CleanupRule" WHERE "accountId" = 'account-id-b';
   ```
   **Expected**: 0 rows (RLS blocks cross-account access)

5. **Test Query With Account B Context**
   ```sql
   -- Set context for Account B
   SET app.current_account_id = 'account-id-b';
   
   -- Should only see Account B's data
   SELECT * FROM "Account" WHERE id = 'account-id-b';
   SELECT * FROM "CleanupRule" WHERE "accountId" = 'account-id-b';
   ```
   **Expected**: Only Account B's data

**✅ Success Criteria**: 
- Without context: 0 rows
- With correct context: Only that account's data
- With wrong context: 0 rows (blocked)

### Option B: Using API Endpoints

1. **Get Account A's Access Token**
   - Connect Account A
   - Note the accountId from dashboard URL

2. **Test API Endpoints**
   ```bash
   # Replace with your actual values
   ACCOUNT_A_ID="your-account-a-id"
   ACCOUNT_B_ID="your-account-b-id"
   BACKEND_URL="https://your-backend.railway.app"
   
   # Should return Account A's rules
   curl "$BACKEND_URL/api/rules/$ACCOUNT_A_ID"
   
   # Should return 404 or empty (can't access Account B's data)
   curl "$BACKEND_URL/api/rules/$ACCOUNT_B_ID"
   ```

**✅ Success Criteria**: API only returns data for the authenticated account

---

## Test 4: OAuth Flow Test

### Goal: Verify new account creation works with RLS

1. **New Account Creation**
   - Use a fresh Klaviyo account (or revoke access and reconnect)
   - Complete OAuth flow
   - Should create new account successfully
   - Should redirect to dashboard

2. **Verify Account Isolation**
   - New account should have empty rules
   - Should not see previous accounts' data

**✅ Success Criteria**: OAuth flow works, new accounts are isolated

---

## Test 5: Scheduled Cleanup Test

### Goal: Verify scheduled cleanup respects RLS

1. **Enable Scheduled Cleanup**
   - For Account A, enable scheduled cleanup
   - Set frequency (24h or 7 days)

2. **Manual Trigger Test**
   - Click "Run Cleanup Now"
   - Should execute successfully
   - Should only process Account A's profiles
   - Check cleanup run history

3. **Verify Run History**
   - Check cleanup runs are created
   - Verify they're associated with correct account
   - Account B should not see Account A's runs

**✅ Success Criteria**: Scheduled cleanup works and respects account boundaries

---

## Test 6: Edge Cases

### Test 6.1: Missing Context
- If RLS context is not set, all queries should return 0 rows
- This is the fail-safe behavior

### Test 6.2: Invalid Account ID
- Try accessing with a non-existent account ID
- Should return 0 rows or 404

### Test 6.3: Deletion Cascade
- Delete an account
- Related rules, logs, and scheduled cleanups should be deleted (CASCADE)
- Other accounts' data should remain intact

---

## Monitoring & Debugging

### Check Application Logs

**Railway (Backend)**
1. Go to Railway dashboard
2. Click on your backend service
3. View logs for any RLS-related errors

**Vercel (Frontend)**
1. Go to Vercel dashboard
2. Click on your project
3. View function logs

### Common Issues

**Issue**: "No rows returned" when there should be data
- **Cause**: RLS context not set properly
- **Fix**: Check `withAccountContext` is being called in backend routes

**Issue**: "Policy violation" errors
- **Cause**: RLS policy too restrictive
- **Fix**: Check policy definitions in `enable_rls.sql`

**Issue**: Can see other users' data
- **Cause**: RLS not enabled or policies not working
- **Fix**: Verify RLS is enabled in Supabase Table Editor

**Issue**: OAuth flow fails
- **Cause**: INSERT policy too restrictive
- **Fix**: Check Account INSERT policy allows creation during OAuth

---

## Automated Testing (Optional)

### Using Postman/Insomnia

Create a test collection:

1. **Setup Request**: Set account context
2. **Test Requests**: 
   - GET rules
   - POST rules
   - GET history
   - POST schedule
3. **Verify**: Responses only contain data for the set account

### Using cURL Script

```bash
#!/bin/bash
# test-rls.sh

BACKEND_URL="https://your-backend.railway.app"
ACCOUNT_ID="your-account-id"

echo "Testing RLS for Account: $ACCOUNT_ID"

# Test getting rules
echo "Getting rules..."
curl -s "$BACKEND_URL/api/rules/$ACCOUNT_ID" | jq '.'

# Test getting history
echo "Getting history..."
curl -s "$BACKEND_URL/api/history/$ACCOUNT_ID" | jq '.'

# Test getting schedule
echo "Getting schedule..."
curl -s "$BACKEND_URL/api/schedule/$ACCOUNT_ID" | jq '.'
```

---

## Success Checklist

- [ ] Basic app functionality works (create rules, scan, delete)
- [ ] Multiple accounts can use the app simultaneously
- [ ] Each account only sees its own data
- [ ] Direct database queries without context return 0 rows
- [ ] Direct database queries with context return only that account's data
- [ ] OAuth flow creates new accounts successfully
- [ ] Scheduled cleanup works and respects account boundaries
- [ ] No errors in application logs
- [ ] No security warnings or policy violations

---

## Next Steps

Once RLS is verified:

1. **Monitor**: Keep an eye on logs for any RLS-related issues
2. **Document**: Note any edge cases you discover
3. **Optimize**: If needed, adjust policies based on usage patterns
4. **Alert**: Set up monitoring for RLS policy violations

---

## Quick Verification Commands

```bash
# Test if RLS is enabled (should return 0 rows)
psql $DATABASE_URL -c "SELECT * FROM \"Account\";"

# Test with context (replace with real account ID)
psql $DATABASE_URL -c "SET app.current_account_id = 'your-account-id'; SELECT * FROM \"Account\";"

# Check RLS status
psql $DATABASE_URL -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';"
```

All tables should show `rowsecurity = true`.

---

## Support

If you encounter issues:
1. Check Supabase logs
2. Check Railway backend logs
3. Verify RLS is enabled on all tables
4. Verify policies exist in Supabase Table Editor → Policies tab
5. Test with direct SQL queries to isolate the issue

