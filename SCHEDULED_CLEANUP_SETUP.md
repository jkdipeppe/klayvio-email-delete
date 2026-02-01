# Scheduled Cleanup Setup Guide

## Overview

Scheduled cleanup allows users to automatically delete spam profiles on a schedule (every 24 hours or 7 days) without manual intervention.

## Features Implemented

✅ **Schedule Options**: Every 24 hours or 7 days
✅ **Manual Trigger**: "Run Now" button for immediate cleanup
✅ **Automatic Token Refresh**: Tokens refresh automatically before cleanup
✅ **Run History**: Track all cleanup runs
✅ **Status Tracking**: See last run time and next scheduled run

## Database Setup

### Step 1: Run Prisma Migration

```bash
cd backend
npx prisma migrate dev --name add_scheduled_cleanup
```

This will create:
- `ScheduledCleanup` table - stores schedule configuration per account
- `CleanupRun` table - tracks history of cleanup runs
- `RunStatus` enum - tracks run status

### Step 2: Update RLS Policies

Run the updated RLS migration in Supabase SQL Editor:

```sql
-- Copy contents from backend/prisma/migrations/enable_rls.sql
-- (The file has been updated with ScheduledCleanup and CleanupRun policies)
```

Or run the additional policies:

```sql
-- Enable RLS on ScheduledCleanup
ALTER TABLE "ScheduledCleanup" ENABLE ROW LEVEL SECURITY;

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

-- Enable RLS on CleanupRun
ALTER TABLE "CleanupRun" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cleanup runs"
  ON "CleanupRun" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account".id = "CleanupRun"."accountId"
      AND check_account_access("Account".id::text)
    )
  );

CREATE POLICY "Users can create cleanup runs for their own account"
  ON "CleanupRun" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account".id = "CleanupRun"."accountId"
      AND check_account_access("Account".id::text)
    )
  );

CREATE POLICY "Users can update cleanup runs for their own account"
  ON "CleanupRun" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "Account"
      WHERE "Account".id = "CleanupRun"."accountId"
      AND check_account_access("Account".id::text)
    )
  );
```

## Railway Cron Setup

### Step 1: Generate API Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Add to Railway Environment Variables

- Variable: `CRON_API_KEY`
- Value: (the generated key)

### Step 3: Set Up Cron Job

See `RAILWAY_CRON_SETUP.md` for detailed instructions.

**Quick setup:**
1. Railway Dashboard → Your Backend Service
2. Add Cron Job (or use Cron service)
3. Schedule: `0 * * * *` (every hour)
4. Command:
   ```bash
   curl -X POST $RAILWAY_PUBLIC_DOMAIN/api/schedule/run -H "X-API-Key: $CRON_API_KEY"
   ```

## How It Works

### User Flow

1. **User enables schedule** in dashboard
2. **Selects frequency**: 24 hours or 7 days
3. **System calculates** next run time
4. **Railway cron** runs every hour
5. **Cron calls** `/api/schedule/run` endpoint
6. **System finds** accounts due for cleanup
7. **For each account**:
   - Refreshes token if needed
   - Scans profiles
   - Deletes matching profiles
   - Updates schedule (lastRunAt, nextRunAt)
   - Creates CleanupRun record

### Manual Trigger

Users can click "Run Cleanup Now" button:
- Immediately processes their account
- Uses same logic as scheduled cleanup
- Updates schedule times

## API Endpoints

### User-Facing

- `GET /api/schedule/:accountId` - Get schedule config
- `POST /api/schedule/:accountId` - Create/update schedule
  ```json
  {
    "isEnabled": true,
    "frequencyDays": 7  // 1 or 7
  }
  ```
- `POST /api/schedule/:accountId/run` - Manual trigger
- `GET /api/schedule/:accountId/history` - Get run history

### System (Protected)

- `POST /api/schedule/run` - Process all due accounts
  - Requires `X-API-Key` header
  - Returns summary of all processed accounts

## Frontend UI

The dashboard now includes:

1. **Enable/Disable Toggle** - Turn scheduled cleanup on/off
2. **Frequency Selection** - Radio buttons for 24h or 7 days
3. **Schedule Info** - Shows last run and next run times
4. **Run Now Button** - Manual trigger button

## Testing

### Test Schedule Creation

```bash
curl -X POST http://localhost:3000/api/schedule/YOUR_ACCOUNT_ID \
  -H "Content-Type: application/json" \
  -d '{"isEnabled": true, "frequencyDays": 7}'
```

### Test Manual Run

```bash
curl -X POST http://localhost:3000/api/schedule/YOUR_ACCOUNT_ID/run
```

### Test Cron Endpoint

```bash
curl -X POST http://localhost:3000/api/schedule/run \
  -H "X-API-Key: YOUR_CRON_API_KEY"
```

## Monitoring

### Check Schedule Status

Query database:
```sql
SELECT * FROM "ScheduledCleanup" WHERE "isEnabled" = true;
```

### Check Recent Runs

```sql
SELECT * FROM "CleanupRun" 
ORDER BY "startedAt" DESC 
LIMIT 10;
```

### Check Next Runs

```sql
SELECT "accountId", "nextRunAt" 
FROM "ScheduledCleanup" 
WHERE "isEnabled" = true 
ORDER BY "nextRunAt";
```

## Troubleshooting

### Schedule not running
- Check Railway cron is configured
- Verify `CRON_API_KEY` is set
- Check cron logs in Railway

### Accounts not being processed
- Verify `isEnabled = true`
- Check `nextRunAt` is in the past
- Verify account has active rules

### Token refresh failures
- Check account tokens are valid
- Verify Klaviyo credentials
- Check error logs

## Next Steps

1. Run database migrations
2. Set up Railway cron job
3. Test with a test account
4. Monitor first few runs
5. Deploy to production

