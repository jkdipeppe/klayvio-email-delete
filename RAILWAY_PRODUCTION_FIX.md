# Railway Production Database Fix

## ✅ Good News: It Works Locally!

Since it works locally, your code and connection string are correct. The issue is Railway configuration.

## Step 1: Copy Your Local DATABASE_URL

Since it works locally, use the same connection string in Railway:

1. **Check your local `.env` file** in `backend/` folder
2. **Copy the `DATABASE_URL` value**
3. **This is the correct connection string** - use it in Railway

## Step 2: Set DATABASE_URL in Railway

1. **Go to Railway Dashboard**
2. **Click your backend service** (the Node.js one)
3. **Go to "Variables" tab**
4. **Find or add `DATABASE_URL`**
5. **Paste the EXACT same value from your local `.env`**
6. **Click Save**

## Step 3: Force Redeploy

**CRITICAL**: Railway doesn't always auto-redeploy when you change variables.

1. Go to **Deployments** tab
2. Click **Redeploy** button
3. Wait for deployment to complete

## Step 4: Check Railway Logs

After redeploy, check logs. You should see:

```
=== DATABASE CONNECTION DEBUG ===
DATABASE_URL exists: true
✅ DATABASE_URL format is valid
Database host: db.xxxxx.supabase.co
Database port: 5432
Database user: postgres
Database name: postgres
================================
Server running on port 3000
```

If you see `DATABASE_URL exists: false`, Railway isn't reading the variable.

## Common Railway Issues

### Issue 1: Variable Not Set at Service Level

Make sure `DATABASE_URL` is on the **backend SERVICE**, not the project:
- ✅ Railway → Backend Service → Variables
- ❌ Railway → Project → Variables

### Issue 2: Not Redeploying After Setting Variable

Railway needs a manual redeploy after changing environment variables:
- Go to Deployments → Redeploy

### Issue 3: Variable Name Typo

Make sure it's exactly: `DATABASE_URL` (case-sensitive, no spaces)

### Issue 4: Using Different Connection String

Use the **exact same** connection string from your local `.env` file.

## Verify It's Working

After setting the variable and redeploying:

1. **Check Railway logs** - should show database connection success
2. **Visit your production frontend URL**
3. **Try OAuth flow** - should work now
4. **Check for database errors** - should be gone

## If Still Not Working

1. **Check Railway Logs** - Look for the debug output
2. **Verify Variable** - Click on `DATABASE_URL` in Railway to see full value
3. **Compare with Local** - Make sure it matches your local `.env` exactly
4. **Try Redeploy Again** - Sometimes Railway needs multiple redeploys

## Quick Checklist

- [ ] Copied DATABASE_URL from local `.env` file
- [ ] Set DATABASE_URL in Railway (backend service, not project)
- [ ] Value matches local exactly
- [ ] Redeployed after setting variable
- [ ] Checked Railway logs for debug output
- [ ] Tested production app

Since it works locally, using the same connection string in Railway should fix it!

