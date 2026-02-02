# Railway Database Connection - Deep Debug

## Situation: DATABASE_URL is Set Correctly But Still Failing

Since the DATABASE_URL matches your local `.env` exactly, let's debug deeper.

## Step 1: Check Railway Logs for Debug Output

After redeploying, check Railway logs. Look for:

```
=== DATABASE CONNECTION DEBUG ===
DATABASE_URL exists: true/false
...
```

**What do you see?**
- If `DATABASE_URL exists: false` → Railway isn't reading it (even though it's set)
- If `DATABASE_URL exists: true` → Connection string is being read, but connection fails

## Step 2: Verify Variable Scope

Make absolutely sure it's set at the **SERVICE level**, not project level:

1. Railway Dashboard
2. Click **your backend service** (the one that runs Node.js/Express)
3. **NOT** the project root
4. Go to **Variables** tab
5. Confirm `DATABASE_URL` is listed here

If it's only at project level, Railway services might not inherit it.

## Step 3: Try Supabase Connection Pooling URL

Even if direct connection works locally, Railway might need the pooled connection:

1. **Go to Supabase** → Settings → Database
2. **Scroll to "Connection Pooling"**
3. **Copy the "Transaction Mode" connection string** (port 6543)
4. **Update Railway `DATABASE_URL`** with this pooled URL
5. **Redeploy**

The pooled URL looks like:
```
postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

## Step 4: Check Prisma Client Generation

Railway might not be generating Prisma Client. Check Railway build logs for:

```
Running "install" command: `npm install`...
Running "build" command: `npm run build`...
```

Look for `prisma generate` in the logs. If you don't see it, Prisma Client isn't being generated.

**Fix**: Make sure `package.json` has:
```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "tsc && prisma generate"
  }
}
```

## Step 5: Test Connection from Railway

Add a test endpoint to verify connection:

```typescript
// Add to backend/src/routes/index.ts
router.get('/api/test-db', async (req, res) => {
  try {
    const count = await prisma.account.count();
    res.json({ success: true, count });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
```

Then visit: `https://your-backend.railway.app/api/test-db`

## Step 6: Check Railway Service Configuration

1. **Go to Railway** → Backend Service → **Settings**
2. **Check "Root Directory"** - should be `backend`
3. **Check build/start commands** - should be correct
4. **Check environment** - should be `production` or not set

## Step 7: Verify Supabase Project Status

1. **Go to Supabase Dashboard**
2. **Check project status** - make sure it's active (not paused)
3. **Check database** - make sure it's running
4. **Check connection limits** - make sure you haven't hit limits

## Step 8: Network/Firewall Check

Supabase might be blocking Railway IPs:

1. **Go to Supabase** → Settings → Database
2. **Check "Connection Pooling"** settings
3. **Look for IP allowlist** - if enabled, Railway IPs might be blocked
4. **Try disabling IP restrictions** temporarily to test

## Step 9: Try Railway's Built-in PostgreSQL (Temporary Test)

To isolate if it's a Supabase-specific issue:

1. **Add PostgreSQL service** in Railway
2. **Railway will auto-provide `DATABASE_URL`**
3. **Test if connection works**
4. **If it works**, the issue is Supabase-specific
5. **If it doesn't work**, the issue is Railway configuration

## Most Likely Issues

Based on "works locally but not in Railway":

1. **Variable scope** - Set at project instead of service level
2. **Connection pooling** - Need pooled URL instead of direct
3. **Prisma Client** - Not generated during Railway build
4. **Network** - Supabase blocking Railway IPs

## Quick Diagnostic Commands

Add this temporarily to see what Railway sees:

```typescript
// In backend/src/index.ts, add before routes
router.get('/debug-env', (req, res) => {
  res.json({
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 20) + '...',
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
  });
});
```

Visit: `https://your-backend.railway.app/debug-env`

This will show if Railway is reading the variable.

## Next Steps

1. **Check Railway logs** for the debug output
2. **Try connection pooling URL** from Supabase
3. **Verify variable is at service level**
4. **Check Prisma Client generation in build logs**

Share what you see in the logs and we can pinpoint the exact issue!

