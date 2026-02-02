# Cron Schedule Update

## Change: Daily at 10:20 PM EST

The cron job has been updated to run **once per day at 10:20 PM EST** instead of every hour.

## Schedule Details

- **Previous**: Every hour (`0 * * * *`)
- **New**: Daily at 3:20 AM UTC (`20 3 * * *`)
- **EST Time**: 10:20 PM EST (3:20 AM UTC during standard time)

## Timezone Note

Vercel cron jobs run in **UTC time**. Since EST is UTC-5 (during standard time):
- **10:20 PM EST** = **3:20 AM UTC** (next day)

During daylight saving time (EDT, UTC-4), 10:20 PM EDT = 2:20 AM UTC (next day), but the cron will still run at 3:20 AM UTC, which is 11:20 PM EDT.

If you need it to run exactly at 10:20 PM EST/EDT regardless of daylight saving, you would need to:
1. Use a service that supports timezone-aware cron (like Railway cron)
2. Or adjust the schedule manually when daylight saving changes

## Cron Expression Format

```
0 5 * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

So `20 3 * * *` means:
- Minute: 20 (20 minutes past the hour)
- Hour: 3 (3 AM UTC)
- Day of month: * (every day)
- Month: * (every month)
- Day of week: * (every day of week)

## Verification

After deploying to Vercel:
1. Go to Vercel Dashboard → Your Project → Settings → Cron Jobs
2. Verify the schedule shows: `20 3 * * *` (Daily at 3:20 AM UTC = 10:20 PM EST)
3. Check the next run time

## Alternative: Railway Cron

If you prefer Railway's cron (which can be more flexible), you can:
1. Set up Railway cron to run at 10:20 PM EST
2. Point it to your backend's `/api/schedule/run` endpoint
3. Remove the Vercel cron configuration

See `RAILWAY_CRON_SETUP.md` for details.

## Summary

- **Cron Expression**: `20 3 * * *`
- **Runs At**: 3:20 AM UTC daily
- **EST Time**: 10:20 PM EST (during standard time)
- **EDT Time**: 11:20 PM EDT (during daylight saving time)

