# Railway Cron Setup - Step by Step Guide

## Important Note

Railway doesn't have a built-in "Cron Jobs" tab. We'll use one of these approaches:
1. **External Cron Service** (easiest) - Use a free service like cron-job.org
2. **Railway Cron Service** - Add a separate cron service (if available)
3. **Self-hosted cron** - Run a cron script inside your app

**Recommended: Use an external cron service** (easiest and most reliable)

---

## Option 1: External Cron Service (Recommended - Easiest)

### Step 1: Generate API Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated key - you'll need it in Step 3.

### Step 2: Add API Key to Railway

1. Go to [railway.app](https://railway.app) and log in
2. Select your backend project
3. Click on your backend service
4. Go to **Variables** tab
5. Click **+ New Variable**
6. Add:
   - **Variable**: `CRON_API_KEY`
   - **Value**: (paste the key from Step 1)
7. Click **Add**

### Step 3: Get Your Backend URL

1. In Railway, go to your backend service
2. Click **Settings** tab
3. Scroll to **Networking** section
4. Copy your **Public Domain** (e.g., `your-app.up.railway.app`)
   - If you don't have one, click **Generate Domain**

### Step 4: Set Up External Cron Service

We'll use **cron-job.org** (free and reliable):

1. Go to [cron-job.org](https://cron-job.org)
2. Sign up for a free account
3. Click **Create cronjob**
4. Fill in:
   - **Title**: Klaviyo Scheduled Cleanup
   - **Address**: `https://your-app.up.railway.app/api/schedule/run`
     - Replace with your Railway domain
   - **Schedule**: Select "Every hour" or use cron: `0 * * * *`
   - **Request method**: POST
   - **Request headers**: 
     - Header name: `X-API-Key`
     - Header value: (paste your CRON_API_KEY from Step 1)
5. Click **Create cronjob**

### Step 5: Test

1. In cron-job.org, click **Execute now** on your cronjob
2. Check Railway logs to see if the request arrived
3. Verify accounts are being processed

---

## Option 2: Railway Cron Service (If Available)

Some Railway plans include a Cron service type:

### Step 1-3: Same as Option 1 (Generate key, add to Railway, get URL)

### Step 4: Add Cron Service

1. In Railway project, click **+ New**
2. Select **Cron** (if available)
3. Configure:
   - **Schedule**: `0 * * * *` (every hour)
   - **Command**: 
     ```bash
     curl -X POST https://your-app.up.railway.app/api/schedule/run -H "X-API-Key: $CRON_API_KEY"
     ```
4. Add environment variable:
   - `CRON_API_KEY` = (your generated key)
   - `RAILWAY_PUBLIC_DOMAIN` = (your backend domain)

---

## Option 3: Self-Hosted Cron Script (Advanced)

Create a cron script that runs inside your app:

### Step 1: Create Cron Script

Create `backend/src/cron.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { ScheduledCleanupService } from './services/scheduled-cleanup';

const prisma = new PrismaClient();
const cleanupService = new ScheduledCleanupService(prisma);

async function runCleanup() {
  console.log('Running scheduled cleanup...');
  try {
    const results = await cleanupService.processDueAccounts();
    console.log(`Processed ${results.length} accounts`);
    console.log(`Total profiles deleted: ${results.reduce((sum, r) => sum + r.profilesDeleted, 0)}`);
  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCleanup();
```

### Step 2: Add to package.json

```json
{
  "scripts": {
    "cron": "ts-node src/cron.ts"
  }
}
```

### Step 3: Use Railway's Scheduled Tasks

Railway doesn't have built-in cron, but you can:
- Use a separate service that runs the cron script
- Or use an external service to call your endpoint (Option 1)

---

## Recommended: Option 1 (External Cron Service)

**Why?**
- ✅ Easiest to set up
- ✅ Free tier available
- ✅ Reliable
- ✅ Easy to monitor
- ✅ No Railway-specific limitations

**Services to use:**
- [cron-job.org](https://cron-job.org) - Free, reliable
- [EasyCron](https://www.easycron.com) - Free tier available
- [Cronitor](https://cronitor.io) - Free tier available

---

## Testing Your Setup

### Test 1: Manual API Call

```bash
# Replace with your values
curl -X POST https://your-app.up.railway.app/api/schedule/run \
  -H "X-API-Key: YOUR_CRON_API_KEY"
```

Expected response:
```json
{
  "total": 0,
  "successful": 0,
  "failed": 0,
  "totalProfilesDeleted": 0,
  "results": []
}
```

### Test 2: Enable Schedule for Test Account

1. Go to your dashboard
2. Enable scheduled cleanup
3. Set frequency to 24 hours
4. Wait for cron to run (or trigger manually)
5. Check cleanup run history

### Test 3: Check Logs

In Railway:
1. Go to your backend service
2. Click **Deployments**
3. Click latest deployment
4. View logs
5. Look for cron job execution

---

## Troubleshooting

### 401 Unauthorized
- ✅ Verify `CRON_API_KEY` is set in Railway
- ✅ Check the API key in cron service matches
- ✅ Verify header name is `X-API-Key` (case-sensitive)

### Cron not running
- ✅ Check cron service logs
- ✅ Verify URL is correct (include `https://`)
- ✅ Check Railway service is running
- ✅ Verify endpoint exists: `/api/schedule/run`

### No accounts processed
- ✅ Check accounts have `isEnabled = true` in database
- ✅ Verify `nextRunAt` is in the past or null
- ✅ Check database connection

---

## Quick Setup Checklist

- [ ] Generated `CRON_API_KEY`
- [ ] Added `CRON_API_KEY` to Railway environment variables
- [ ] Got Railway backend public domain
- [ ] Created cron job in external service (cron-job.org)
- [ ] Set schedule to every hour (`0 * * * *`)
- [ ] Configured POST request to `/api/schedule/run`
- [ ] Added `X-API-Key` header
- [ ] Tested manually with curl
- [ ] Verified cron job runs successfully

---

## Alternative: Use GitHub Actions (Free)

If you prefer not to use external services, you can use GitHub Actions:

Create `.github/workflows/scheduled-cleanup.yml`:

```yaml
name: Scheduled Cleanup

on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch:  # Allow manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cleanup
        run: |
          curl -X POST ${{ secrets.BACKEND_URL }}/api/schedule/run \
            -H "X-API-Key: ${{ secrets.CRON_API_KEY }}"
```

Then add secrets in GitHub:
- `BACKEND_URL` - Your Railway backend URL
- `CRON_API_KEY` - Your cron API key

---

## Summary

**Easiest approach**: Use cron-job.org (Option 1)
1. Generate API key
2. Add to Railway env vars
3. Create cron job in cron-job.org
4. Point to your Railway endpoint
5. Done!

This takes about 5 minutes and requires no code changes.

