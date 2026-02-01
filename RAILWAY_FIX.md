# Railway Deployment Fix - Root Directory Issue

## Problem

Railway is trying to build from the root directory, but your backend code is in the `backend/` subdirectory.

## Solution: Set Root Directory in Railway Dashboard

### Step-by-Step Fix

1. **Go to Railway Dashboard**
   - Navigate to [railway.app](https://railway.app)
   - Select your project
   - Click on your backend service

2. **Open Settings**
   - Click the **Settings** tab
   - Scroll down to find **Source** section

3. **Set Root Directory**
   - Find **Root Directory** field
   - Change it from `.` (or empty) to: `backend`
   - Click **Save** or **Update**

4. **Redeploy**
   - Railway will automatically trigger a new deployment
   - Or manually trigger: Click **Deployments** → **Redeploy**

5. **Verify**
   - Check build logs
   - Should now see: "Installing dependencies..." from backend folder
   - Should detect Node.js automatically

## What This Does

Setting root directory to `backend` tells Railway:
- Look for `package.json` in `backend/` folder
- Run `npm install` in that directory
- Run `npm run build` in that directory  
- Start with `npm start` from that directory

## Alternative: Separate Railway Service

If you can't set root directory, you can:

1. **Create a new Railway service** specifically for backend
2. **Connect it to the same GitHub repo**
3. **Set root directory** to `backend` for that service
4. **Deploy separately** from frontend

## Verify It's Working

After setting root directory, the build logs should show:

```
[Region: us-east4]
╭─────────────────╮
│ Railpack 0.17.1 │
╰─────────────────╯

✓ Detected Node.js
✓ Installing dependencies...
✓ Building...
✓ Starting...
```

Instead of the error you're seeing.

## Quick Fix Checklist

- [ ] Go to Railway → Backend Service → Settings
- [ ] Find "Root Directory" setting
- [ ] Change to `backend`
- [ ] Save changes
- [ ] Wait for redeploy
- [ ] Check logs - should build successfully

This is the standard way to handle monorepos in Railway!

