# Vercel Cron Setup Guide

## Overview

**Yes! Vercel has native cron support**, and our implementation already does exactly what you want:

✅ **One cron job** that runs on a schedule  
✅ **Checks database** for users with `isEnabled = true`  
✅ **Processes all enabled accounts** automatically  
✅ **Users control** whether their account is included (via enable/disable toggle)

## How It Works

```
┌─────────────────┐
│ Vercel Cron     │  Runs every hour (configurable)
│ (Native)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Next.js API     │  /api/cron/schedule-run
│ Route           │  (Protected by CRON_SECRET)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Backend API     │  POST /api/schedule/run
│ (Railway)       │  (Protected by CRON_API_KEY)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Database Query  │  Find accounts where:
│                 │  - isEnabled = true
│                 │  - nextRunAt <= now()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Process Each    │  For each account:
│ Account         │  1. Refresh token if needed
│                 │  2. Scan profiles
│                 │  3. Delete matches
│                 │  4. Update nextRunAt
└─────────────────┘
```

## Setup Steps

### Step 1: Generate Secrets

Generate two secrets:

```bash
# For Vercel Cron (protects the Next.js API route)
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# For Backend API (protects the backend endpoint)
node -e "console.log('CRON_API_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Add to Vercel Environment Variables

1. Go to [vercel.com](https://vercel.com) → Your project
2. Go to **Settings** → **Environment Variables**
3. Add these variables:

**For Production:**
- `CRON_SECRET` = (first generated secret)
- `CRON_API_KEY` = (second generated secret)
- `BACKEND_URL` = (your Railway backend URL, e.g., `https://your-app.up.railway.app`)

**For Preview/Development** (optional):
- Same variables if you want to test

### Step 3: Add to Railway Environment Variables

1. Go to Railway → Your backend service
2. Go to **Variables** tab
3. Add:
   - `CRON_API_KEY` = (same as second secret from Step 1)

### Step 4: Configure Vercel Cron

The `vercel.json` file already has cron configuration:

```json
{
  "crons": [
    {
      "path": "/api/cron/schedule-run",
      "schedule": "0 * * * *"  // Every hour
    }
  ]
}
```

**Schedule Options:**
- `0 * * * *` - Every hour (recommended)
- `0 */6 * * *` - Every 6 hours
- `0 0 * * *` - Daily at midnight UTC
- `*/30 * * * *` - Every 30 minutes

### Step 5: Deploy

1. Push your code to GitHub
2. Vercel will auto-deploy
3. Cron job will be automatically set up

### Step 6: Verify

1. Go to Vercel Dashboard → Your project
2. Go to **Deployments** tab
3. Click on latest deployment
4. Go to **Functions** tab
5. You should see `/api/cron/schedule-run` listed
6. Check **Logs** tab to see cron executions

## How Users Control It

Users control whether their account is processed via the dashboard:

1. **Enable/Disable Toggle** - User turns scheduled cleanup on/off
2. **Frequency Selection** - User chooses 24h or 7 days
3. **System checks database** - Cron finds accounts with `isEnabled = true`
4. **Only processes enabled accounts** - Disabled accounts are skipped

## Testing

### Test 1: Manual Trigger (Vercel)

Vercel allows manual cron triggers:

1. Go to Vercel Dashboard → Your project
2. Go to **Deployments** → Latest deployment
3. Go to **Functions** → `/api/cron/schedule-run`
4. Click **Run** (if available) or use the API

### Test 2: Manual API Call

```bash
# Test the Vercel cron endpoint
curl -X POST https://your-app.vercel.app/api/cron/schedule-run \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Test 3: Check Backend Logs

After cron runs, check Railway logs to see:
- How many accounts were processed
- Results for each account
- Any errors

## Monitoring

### Vercel Dashboard

1. **Deployments** → **Functions** → View cron execution logs
2. **Analytics** → See function invocations
3. **Logs** → Real-time execution logs

### Database Queries

Check which accounts are scheduled:

```sql
SELECT 
  "accountId", 
  "isEnabled", 
  "frequencyDays", 
  "lastRunAt", 
  "nextRunAt"
FROM "ScheduledCleanup"
WHERE "isEnabled" = true
ORDER BY "nextRunAt";
```

Check recent runs:

```sql
SELECT 
  "accountId",
  "startedAt",
  "status",
  "profilesFound",
  "profilesDeleted",
  "profilesFailed"
FROM "CleanupRun"
ORDER BY "startedAt" DESC
LIMIT 20;
```

## Advantages of Vercel Cron

✅ **Native support** - Built into Vercel, no external services  
✅ **Free tier** - Included with Vercel hosting  
✅ **Easy monitoring** - View logs in Vercel dashboard  
✅ **Reliable** - Managed by Vercel infrastructure  
✅ **Automatic** - Set up when you deploy  
✅ **Manual triggers** - Can trigger manually for testing  

## Schedule Customization

Users can't set custom schedules (they choose 24h or 7 days), but the cron runs every hour and checks if each account is due. This means:

- **24h schedule**: Account runs once per day (when cron finds it's due)
- **7 day schedule**: Account runs once per week (when cron finds it's due)

The cron frequency (every hour) doesn't affect user schedules - it just checks more frequently.

## Troubleshooting

### Cron not running
- Check `vercel.json` has cron configuration
- Verify deployment succeeded
- Check Vercel dashboard for cron job status

### 401 Unauthorized
- Verify `CRON_SECRET` matches in Vercel env vars
- Check Authorization header format

### No accounts processed
- Check accounts have `isEnabled = true`
- Verify `nextRunAt` is in the past or null
- Check database connection

### Backend not responding
- Verify `BACKEND_URL` is correct
- Check Railway service is running
- Verify `CRON_API_KEY` matches

## Summary

✅ **Vercel has native cron** - Use `vercel.json` to configure  
✅ **One cron processes all users** - Checks database for enabled accounts  
✅ **Users control via dashboard** - Enable/disable toggle  
✅ **Automatic token refresh** - Works seamlessly  
✅ **No external services needed** - Everything in Vercel + Railway  

This is the cleanest solution - native Vercel cron that calls your backend, which processes all enabled accounts from the database!

