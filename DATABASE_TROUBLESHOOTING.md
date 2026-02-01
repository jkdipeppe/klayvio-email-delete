# Database Connection Troubleshooting

## Still Getting Connection Errors?

If you've added `DATABASE_URL` to Railway but still getting errors, try these steps:

## Step 1: Verify Railway Environment Variable

1. **Go to Railway Dashboard**
   - Click your backend service
   - Go to **Variables** tab
   - Find `DATABASE_URL`
   - **Click on it** to see the full value
   - Make sure it's not empty or has placeholder text

2. **Check the Format**
   - Should start with `postgresql://`
   - Should NOT have `[YOUR-PASSWORD]` placeholder
   - Should have actual password

## Step 2: Get Fresh Connection String from Supabase

1. Go to **Supabase Dashboard** → Your Project
2. **Settings** → **Database**
3. Scroll to **Connection string**
4. Click **URI** tab
5. **Copy the connection string**
6. It should look like:
   ```
   postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
   OR
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```

## Step 3: Update Railway Variable

1. In Railway → Variables → `DATABASE_URL`
2. **Delete the old value**
3. **Paste the new connection string**
4. **Replace `[YOUR-PASSWORD]`** with your actual database password
5. **Save**

## Step 4: Force Redeploy

After updating the variable:

1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment
3. OR push a new commit to trigger redeploy

**Important**: Railway doesn't always auto-redeploy when you change environment variables. You may need to manually redeploy.

## Step 5: Check Railway Logs

1. Go to Railway → Your Service → **Logs**
2. Look for:
   - Prisma initialization messages
   - Database connection errors
   - Any error messages about `DATABASE_URL`

## Common Issues & Fixes

### Issue 1: Password Has Special Characters

If your password contains special characters like `@`, `#`, `%`, etc., they need to be URL-encoded:

- `@` → `%40`
- `#` → `%23`
- `%` → `%25`
- `/` → `%2F`
- `:` → `%3A`

**Example:**
If password is `my@pass#123`, use: `my%40pass%23123`

### Issue 2: Using Wrong Connection String Format

Supabase provides different connection strings:

**For Railway (Server-side app)**, use **Transaction Mode**:
```
postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**OR Direct Connection**:
```
postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

Try **Transaction Mode first** (port 6543) - it's better for server-side apps.

### Issue 3: Connection String Has Extra Quotes

Make sure there are NO quotes around the connection string in Railway:
- ❌ Wrong: `"postgresql://..."`
- ✅ Correct: `postgresql://...`

### Issue 4: Railway Not Picking Up Variable

1. **Check Variable Scope**
   - Make sure `DATABASE_URL` is set at the **Service level**, not Project level
   - Go to your backend service → Variables (not project → Variables)

2. **Verify Variable Name**
   - Must be exactly: `DATABASE_URL` (case-sensitive)
   - No extra spaces or characters

3. **Redeploy After Setting**
   - Railway needs to redeploy to pick up new environment variables
   - Go to Deployments → Redeploy

### Issue 5: Network/Firewall Issues

Supabase might be blocking Railway's IP:

1. Go to **Supabase** → **Settings** → **Database**
2. Check **Connection Pooling** settings
3. If there's an IP allowlist, make sure Railway IPs are allowed
4. Or disable IP restrictions for testing

### Issue 6: Database Password Changed

If you reset your Supabase database password:

1. Get the new connection string from Supabase
2. Update `DATABASE_URL` in Railway
3. Redeploy

## Test Connection String Locally

Before adding to Railway, test it locally:

1. **Create a test file** `test-db.js`:
   ```javascript
   const { PrismaClient } = require('@prisma/client');
   
   const prisma = new PrismaClient({
     datasources: {
       db: {
         url: process.env.DATABASE_URL
       }
     }
   });
   
   async function test() {
     try {
       await prisma.$connect();
       console.log('✅ Database connection successful!');
       const count = await prisma.account.count();
       console.log(`Found ${count} accounts`);
       await prisma.$disconnect();
     } catch (error) {
       console.error('❌ Database connection failed:', error.message);
       process.exit(1);
     }
   }
   
   test();
   ```

2. **Run it**:
   ```bash
   cd backend
   DATABASE_URL="your-connection-string-here" node test-db.js
   ```

3. **If it works locally**, the connection string is correct - the issue is with Railway configuration

## Verify Railway Configuration

### Check These in Railway:

1. ✅ **Service Name**: Backend service (not frontend)
2. ✅ **Root Directory**: Set to `backend`
3. ✅ **Variables**: `DATABASE_URL` exists and has correct value
4. ✅ **Deployment**: Latest deployment succeeded
5. ✅ **Logs**: No connection errors in recent logs

## Alternative: Use Supabase Connection Pooling URL

If direct connection doesn't work, try the pooled connection:

1. Go to Supabase → **Settings** → **Database**
2. Scroll to **Connection Pooling**
3. Copy the **Transaction Mode** connection string
4. Use port **6543** (not 5432)
5. Add to Railway as `DATABASE_URL`
6. Redeploy

## Debug Steps

Run through this checklist:

- [ ] Railway → Backend Service → Variables → `DATABASE_URL` exists
- [ ] `DATABASE_URL` value starts with `postgresql://`
- [ ] `DATABASE_URL` has actual password (not `[YOUR-PASSWORD]`)
- [ ] No quotes around connection string
- [ ] Password special characters are URL-encoded
- [ ] Redeployed after setting variable
- [ ] Checked Railway logs for errors
- [ ] Tested connection string locally (if possible)

## Still Not Working?

If none of the above works:

1. **Check Railway Logs** for the exact error message
2. **Check Supabase Logs** (Dashboard → Logs) for connection attempts
3. **Try creating a new Supabase project** and use that connection string
4. **Verify Supabase project is active** (not paused or deleted)

## Quick Test: Add Logging

Temporarily add this to `backend/src/index.ts` to see what DATABASE_URL Railway is using:

```typescript
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL starts with postgresql:', process.env.DATABASE_URL?.startsWith('postgresql'));
// Don't log the full URL (contains password) - just verify it exists
```

Then check Railway logs to see if the variable is being read.

