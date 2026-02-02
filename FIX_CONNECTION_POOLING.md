# Fix: Can't Reach Database Server

## Problem

Railway can read `DATABASE_URL` but can't connect to Supabase on port 5432. This is a network connectivity issue.

## Solution: Use Supabase Connection Pooling

Railway needs to use Supabase's **connection pooling** URL (port 6543) instead of direct connection (port 5432).

## Step-by-Step Fix

### Step 1: Get Connection Pooling URL from Supabase

1. **Go to Supabase Dashboard** → Your Project
2. **Settings** → **Database**
3. **Scroll to "Connection Pooling"** section
4. **Copy the "Transaction Mode" connection string**
   - It uses port **6543** (not 5432)
   - Host will be something like `aws-0-us-east-1.pooler.supabase.com`
   - Format: `postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

### Step 2: Update Railway DATABASE_URL

1. **Go to Railway** → Backend Service → **Variables**
2. **Click `DATABASE_URL`**
3. **Replace the entire value** with the connection pooling URL
4. **Make sure to replace `YOUR_PASSWORD`** with your actual password
5. **Save**

### Step 3: Redeploy

1. **Go to Deployments** tab
2. **Click Redeploy**
3. **Wait for deployment**

### Step 4: Verify

After redeploy, check logs. You should see:
- `Database port: 6543` (instead of 5432)
- No more "Can't reach database server" errors
- OAuth flow should work

## Why This Works

- **Port 5432**: Direct connection - Railway's network might block this
- **Port 6543**: Connection pooling - Designed for serverless/server environments, works better with Railway

## Connection String Format

**Old (Direct - Not Working):**
```
postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

**New (Pooled - Should Work):**
```
postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

Notice:
- Different host (pooler.supabase.com)
- Different port (6543)
- Different username format (postgres.xxxxx)

## If You Don't See Connection Pooling Option

1. **Check Supabase project tier** - Connection pooling might require a paid plan
2. **Try Session Mode** (port 5432) - Sometimes works better than direct
3. **Check Supabase status** - Make sure project is active

## Alternative: Check Supabase Network Settings

If connection pooling doesn't work:

1. **Go to Supabase** → Settings → Database
2. **Check "Network Restrictions"**
3. **Make sure Railway IPs aren't blocked**
4. **Or disable restrictions temporarily** to test

## Quick Checklist

- [ ] Got connection pooling URL from Supabase (port 6543)
- [ ] Updated DATABASE_URL in Railway with pooled URL
- [ ] Replaced YOUR_PASSWORD with actual password
- [ ] Redeployed Railway
- [ ] Checked logs - should show port 6543
- [ ] Tested OAuth flow - should work now

This should fix the connection issue!

