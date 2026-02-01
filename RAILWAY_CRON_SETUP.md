# Railway Cron Setup Guide

## Overview

Railway supports cron jobs that can call your API endpoints on a schedule. This guide shows how to set up the scheduled cleanup cron job.

## Option 1: Railway Dashboard (Recommended)

### Step 1: Generate API Key

1. Generate a secure API key for your cron job:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. Add it to Railway environment variables:
   - Variable: `CRON_API_KEY`
   - Value: (the generated key)

### Step 2: Get Your Railway URL

1. In Railway dashboard, go to your backend service
2. Go to Settings → Networking
3. Copy your public domain (e.g., `your-app.up.railway.app`)

### Step 3: Create Cron Job

1. In Railway dashboard, go to your backend service
2. Click on "Cron Jobs" tab (or "Add Service" → "Cron")
3. Click "New Cron Job"
4. Configure:
   - **Schedule**: `0 * * * *` (every hour)
   - **Command**: 
     ```bash
     curl -X POST https://your-app.up.railway.app/api/schedule/run -H "X-API-Key: $CRON_API_KEY"
     ```
   - Replace `your-app.up.railway.app` with your actual Railway domain

### Step 4: Test

1. Manually trigger the cron job from Railway dashboard
2. Check logs to verify it's calling your endpoint
3. Verify accounts are being processed

## Option 2: railway.json (Alternative)

The `railway.json` file includes cron configuration, but Railway's cron support via config file is limited. The dashboard method is more reliable.

## Schedule Options

### Every Hour (Recommended)
```
0 * * * *
```

### Every 6 Hours
```
0 */6 * * *
```

### Daily at Midnight UTC
```
0 0 * * *
```

### Every 12 Hours
```
0 */12 * * *
```

## Environment Variables Needed

Make sure these are set in Railway:

- `CRON_API_KEY` - Secret key to protect cron endpoint
- `DATABASE_URL` - Your Supabase connection string
- `KLAVIYO_CLIENT_ID` - Your Klaviyo app client ID
- `KLAVIYO_CLIENT_SECRET` - Your Klaviyo app secret
- `APP_SECRET` - Encryption secret
- `FRONTEND_URL` - Your frontend URL

## Testing the Cron Endpoint

### Manual Test

```bash
# Replace with your actual values
curl -X POST https://your-app.up.railway.app/api/schedule/run \
  -H "X-API-Key: your-cron-api-key"
```

### Expected Response

```json
{
  "total": 2,
  "successful": 2,
  "failed": 0,
  "totalProfilesDeleted": 15,
  "results": [
    {
      "accountId": "...",
      "success": true,
      "profilesFound": 10,
      "profilesDeleted": 10,
      "profilesFailed": 0
    }
  ]
}
```

## Troubleshooting

### Cron job not running
- Check Railway cron job logs
- Verify schedule syntax is correct
- Check that command is correct

### 401 Unauthorized
- Verify `CRON_API_KEY` is set correctly
- Check that the API key in the curl command matches

### No accounts processed
- Check that accounts have `isEnabled = true`
- Verify `nextRunAt` is in the past or null
- Check database connection

### Token refresh failures
- Check account tokens are valid
- Verify Klaviyo credentials are correct
- Check logs for specific error messages

## Monitoring

### Check Cron Logs
- Railway dashboard → Your service → Deployments → View logs
- Look for cron job execution logs

### Check Cleanup Runs
- Query `CleanupRun` table in database
- Check `status` field for success/failure
- Review `errorMessage` for failures

## Security Notes

- **Never commit `CRON_API_KEY` to git**
- Use strong, random API keys
- Rotate keys periodically
- Monitor for unauthorized access attempts

