# Vercel Deployment Fix - Root Directory Issue

## Problem

Vercel is trying to build from the root directory, but your frontend code is in the `frontend/` subdirectory.

## Solution: Set Root Directory in Vercel Dashboard

### Step-by-Step Fix

1. **Go to Vercel Dashboard**
   - Navigate to [vercel.com](https://vercel.com)
   - Select your project
   - Click **Settings**

2. **Open General Settings**
   - In the left sidebar, click **General**
   - Scroll to **Root Directory** section

3. **Set Root Directory**
   - Find **Root Directory** field
   - Click **Edit**
   - Change from `.` (or empty) to: `frontend`
   - Click **Save**

4. **Redeploy**
   - Go to **Deployments** tab
   - Click **Redeploy** on latest deployment
   - Or push a new commit to trigger auto-deploy

5. **Verify**
   - Check build logs
   - Should now detect Next.js correctly
   - Should build successfully

## What This Does

Setting root directory to `frontend` tells Vercel:
- Look for `package.json` in `frontend/` folder
- Run `npm install` in that directory
- Run `npm run build` in that directory
- Deploy the Next.js app from that directory

## Additional Fixes Applied

1. **Updated Next.js version** - Fixed security vulnerability
   - Changed from `14.0.4` to `^14.2.0` (patched version)
   - Run `npm install` in the `frontend/` directory to update

2. **Fixed vercel.json** - Removed invalid rewrites (handled by next.config.js instead)
   - Only contains cron job configuration now

## Verify It's Working

After setting root directory, the build logs should show:

```
✓ Installing dependencies from frontend/package.json
✓ Building Next.js app
✓ Build completed successfully
```

Instead of trying to build from root.

## Quick Fix Checklist

- [ ] Go to Vercel → Project → Settings → General
- [ ] Find "Root Directory" setting
- [ ] Change to `frontend`
- [ ] Save changes
- [ ] Redeploy
- [ ] Check logs - should build successfully

## Alternative: Deploy Frontend Separately

If you prefer, you can:

1. **Create a separate Vercel project** for frontend only
2. **Point it to the same GitHub repo**
3. **Set root directory** to `frontend`
4. **Deploy independently** from backend

This is the standard way to handle monorepos in Vercel!

