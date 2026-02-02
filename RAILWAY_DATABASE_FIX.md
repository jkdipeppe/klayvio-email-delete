# Railway Database Connection Fix

## Error: Can't reach database server

This means Railway can't connect to Supabase. Let's fix it step by step.

## Step 1: Verify DATABASE_URL in Railway

1. **Go to Railway Dashboard**
2. **Click your backend service** (not the project, the SERVICE)
3. **Click "Variables" tab**
4. **Look for `DATABASE_URL`**
5. **Click on it** to see the full value

### What to check:
- ✅ Does it exist?
- ✅ Does it start with `postgresql://`?
- ✅ Does it have a real password (not `[YOUR-PASSWORD]`)?
- ✅ No extra quotes around it?

## Step 2: Get Correct Connection String from Supabase

1. **Go to Supabase Dashboard** → Your Project
2. **Settings** → **Database**
3. **Scroll to "Connection string"**
4. **Click "URI" tab** (not Session mode)
5. **Copy the connection string**

It should look like one of these:

**Option A - Transaction Mode (Recommended for Railway):**
```
postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Option B - Direct Connection:**
```
postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

## Step 3: Update Railway Variable

1. **In Railway Variables**, click `DATABASE_URL`
2. **Delete everything** in the value field
3. **Paste your connection string**
4. **Replace `YOUR_PASSWORD`** with your actual database password
5. **Click Save**

### Important Notes:
- **No quotes** around the connection string
- If password has special characters, URL-encode them:
  - `@` → `%40`
  - `#` → `%23`
  - `%` → `%25`
  - `/` → `%2F`
  - `:` → `%3A`

## Step 4: Force Redeploy

**CRITICAL**: Railway doesn't always auto-redeploy when you change variables.

1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment
3. Wait for deployment to complete

## Step 5: Check Logs

After redeploy, check Railway logs:

1. Go to **Logs** tab
2. Look for:
   ```
   DATABASE_URL exists: true
   DATABASE_URL format check: ✅ Valid format
   Database host: db.xxxxx.supabase.co
   Database port: 5432
   ```

If you see `DATABASE_URL exists: false`, Railway isn't reading the variable.

## Common Issues

### Issue 1: Variable Not at Service Level

Make sure `DATABASE_URL` is set on the **backend SERVICE**, not the project.

- ✅ Correct: Railway → Backend Service → Variables
- ❌ Wrong: Railway → Project → Variables

### Issue 2: Using Wrong Connection String

Try **Transaction Mode** (port 6543) first - it's better for server-side apps:

```
postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### Issue 3: Password Encoding

If your password is `my@pass#123`, use: `my%40pass%23123`

### Issue 4: Supabase Project Paused

Check if your Supabase project is active:
- Go to Supabase Dashboard
- Check project status
- Make sure it's not paused

### Issue 5: Network/Firewall

Supabase might be blocking Railway IPs:
1. Go to Supabase → Settings → Database
2. Check Connection Pooling settings
3. Disable IP restrictions (or add Railway IPs)

## Test Connection String Locally

Before adding to Railway, test it locally:

```bash
cd backend
DATABASE_URL="your-connection-string-here" npm run dev
```

If it works locally, the connection string is correct - the issue is Railway configuration.

## Alternative: Use Railway's PostgreSQL

If Supabase continues to have issues, you can use Railway's built-in PostgreSQL:

1. In Railway, add a **PostgreSQL** service
2. Railway will provide a `DATABASE_URL` automatically
3. Update your Prisma schema to use it
4. Run migrations

But Supabase should work fine - this is usually a configuration issue.

## Still Not Working?

1. **Check Railway Logs** - Look for the exact error message
2. **Check Supabase Logs** - See if connection attempts are being made
3. **Verify Supabase Project** - Make sure it's active and not paused
4. **Try Direct Connection** - Use port 5432 instead of 6543
5. **Contact Support** - Railway or Supabase support can help debug

## Quick Checklist

- [ ] DATABASE_URL exists in Railway (backend service)
- [ ] Connection string starts with `postgresql://`
- [ ] Password is replaced (not `[YOUR-PASSWORD]`)
- [ ] No quotes around connection string
- [ ] Special characters in password are URL-encoded
- [ ] Redeployed after setting variable
- [ ] Checked Railway logs for errors
- [ ] Verified Supabase project is active

