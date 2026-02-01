# Database Connection Error Fix

## Error Message

```
Can't reach database server at `db.lwygcwgdousgtyftggtl.supabase.co:5432`
```

## Root Cause

The `DATABASE_URL` environment variable in Railway is either:
1. Not set
2. Set incorrectly
3. Using the wrong connection string format

## Solution

### Step 1: Get Your Supabase Connection String

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **Database**
4. Scroll to **Connection string** section
5. Select **URI** tab (not Session mode)
6. Copy the connection string

It should look like:
```
postgresql://postgres:[YOUR-PASSWORD]@db.lwygcwgdousgtyftggtl.supabase.co:5432/postgres
```

**Important**: Make sure you're using the **URI** format, not Session mode.

### Step 2: Set DATABASE_URL in Railway

1. Go to Railway Dashboard
2. Click on your backend service
3. Go to **Variables** tab
4. Find or add `DATABASE_URL`
5. Paste your Supabase connection string
6. **Replace `[YOUR-PASSWORD]`** with your actual database password
7. Click **Save**

### Step 3: Verify Connection String Format

The connection string should be:
```
postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1
```

Or without pgbouncer:
```
postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

### Step 4: Redeploy

After setting the variable:
1. Railway should auto-redeploy
2. Or manually trigger: **Deployments** → **Redeploy**

### Step 5: Verify Connection

Check Railway logs to see if the connection works:
1. Go to Railway → Your Service → **Logs**
2. Look for successful database connection messages
3. Check for any Prisma errors

## Alternative: Use Connection Pooling (Recommended for Production)

Supabase recommends using connection pooling for server-side applications.

### Option A: Transaction Mode (Port 6543)

Use this for most server-side apps:

```
postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:6543/postgres?pgbouncer=true
```

### Option B: Session Mode (Port 5432)

Use this for migrations:

```
postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

**For Railway backend**, use **Transaction Mode (port 6543)** with pgbouncer.

## Quick Fix Checklist

- [ ] Go to Supabase → Settings → Database
- [ ] Copy connection string (URI format)
- [ ] Go to Railway → Variables
- [ ] Set `DATABASE_URL` with the connection string
- [ ] Replace `[YOUR-PASSWORD]` with actual password
- [ ] Save and redeploy
- [ ] Check logs for connection success

## Troubleshooting

### Still Getting Connection Errors?

1. **Check Password**
   - Make sure password is correct (no extra spaces)
   - Password might contain special characters - URL encode them if needed

2. **Check Network Access**
   - Supabase might have IP restrictions
   - Go to Supabase → Settings → Database → Connection Pooling
   - Check if IP allowlist is enabled
   - Railway IPs should be allowed (or disable IP restrictions for testing)

3. **Try Direct Connection**
   - Use port 5432 (Session mode) instead of 6543
   - This bypasses connection pooling

4. **Check Railway Logs**
   - Look for more detailed error messages
   - Check if Prisma is initializing correctly

5. **Verify Environment Variable**
   - In Railway, check that `DATABASE_URL` is actually set
   - Make sure there are no typos
   - Check for extra quotes or spaces

### Connection String Examples

**Transaction Mode (Recommended)**:
```
postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Direct Connection**:
```
postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

**With Connection Pooling**:
```
postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1
```

## Security Note

⚠️ **Never commit your `DATABASE_URL` to git!**

- It contains your database password
- Always use environment variables
- Railway automatically keeps these secure

## Verify It's Working

After fixing, test the connection:

1. **Check Railway Logs**
   - Should see Prisma connecting successfully
   - No connection errors

2. **Test API Endpoint**
   ```bash
   curl https://your-backend.railway.app/api/rules/test-account-id
   ```
   - Should return data or proper error (not connection error)

3. **Check Supabase Dashboard**
   - Go to Database → Logs
   - Should see connection attempts from Railway

## Still Having Issues?

1. Check Supabase status page
2. Verify your Supabase project is active
3. Check Railway service status
4. Review both Supabase and Railway logs together

