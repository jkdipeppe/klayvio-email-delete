# Vercel Cron Quick Start

## ✅ Yes! Vercel Has Native Cron Support

And our implementation already does exactly what you want:
- **One cron job** runs on schedule
- **Checks database** for users with `isEnabled = true`
- **Processes all enabled accounts** automatically
- **Users control** via enable/disable toggle in dashboard

## How It Works

```
Vercel Cron (every hour)
    ↓
/api/cron/schedule-run (Next.js API route)
    ↓
Backend /api/schedule/run (Railway)
    ↓
Database Query: Find accounts where isEnabled = true AND nextRunAt <= now()
    ↓
For each account:
  - Refresh token if needed
  - Scan profiles
  - Delete matches
  - Update nextRunAt
```

## Setup (3 Steps)

### Step 1: Generate Secrets

```bash
# Generate CRON_SECRET (for Vercel)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate CRON_API_KEY (for backend)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Add Environment Variables

**In Vercel:**
- Go to Project → Settings → Environment Variables
- Add:
  - `CRON_SECRET` = (first generated value)
  - `CRON_API_KEY` = (second generated value)
  - `BACKEND_URL` = (your Railway backend URL)

**In Railway:**
- Go to Backend Service → Variables
- Add:
  - `CRON_API_KEY` = (same as second value)

### Step 3: Deploy

1. Push code to GitHub
2. Vercel auto-deploys
3. Cron is automatically set up!

The `vercel.json` file already has:
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

## That's It!

Once deployed:
- ✅ Vercel cron runs every hour
- ✅ Calls `/api/cron/schedule-run`
- ✅ Which calls backend `/api/schedule/run`
- ✅ Backend queries database for enabled accounts
- ✅ Processes all of them automatically

## User Control

Users control it via dashboard:
1. Toggle "Enable automatic cleanup" ON/OFF
2. Select frequency: 24 hours or 7 days
3. System automatically includes/excludes them from cron processing

## Verify It's Working

1. **Vercel Dashboard** → Your project → Deployments → Functions
2. You'll see `/api/cron/schedule-run` listed
3. Check **Logs** to see executions
4. Check database `CleanupRun` table for run history

## Schedule Options

Edit `vercel.json` to change frequency:

- `0 * * * *` - Every hour (current)
- `*/30 * * * *` - Every 30 minutes
- `0 */6 * * *` - Every 6 hours
- `0 0 * * *` - Daily at midnight

The cron frequency doesn't affect user schedules - it just checks more often. Users' 24h/7d settings determine when their account is actually processed.

