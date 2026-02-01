# Railway Deployment Fix

## Problem

Railway is trying to build from the root directory, but the backend code is in the `backend/` subdirectory.

## Solution: Configure Root Directory

### Option 1: Railway Dashboard (Easiest)

1. Go to Railway Dashboard → Your Backend Service
2. Click **Settings** tab
3. Scroll to **Source** section
4. Find **Root Directory** setting
5. Change from `.` (root) to `backend`
6. Save changes
7. Redeploy

Railway will now:
- Look for `package.json` in the `backend/` folder
- Auto-detect Node.js
- Run `npm install` and `npm run build` automatically
- Start with `npm start`

### Option 2: Use railway.toml (Alternative)

I've created a `railway.toml` file in the root that specifies the backend directory. Railway should pick this up automatically.

### Option 3: Move Backend to Root (Not Recommended)

You could move all backend files to root, but this would mix frontend and backend code.

## Verify Build Settings

After setting root directory, Railway should show:
- **Detected**: Node.js
- **Build Command**: `npm install && npm run build` (or auto-detected)
- **Start Command**: `npm start` (or auto-detected)

## Test Deployment

1. Set root directory to `backend`
2. Trigger a new deployment
3. Check build logs - should see:
   ```
   Installing dependencies...
   Building...
   Starting...
   ```

## Troubleshooting

### Still can't find package.json
- Verify root directory is set to `backend` (not `./backend`)
- Check that `backend/package.json` exists
- Make sure you've committed and pushed the code

### Build fails
- Check that all dependencies are in `package.json`
- Verify `npm run build` works locally
- Check Railway logs for specific errors

### Start command fails
- Verify `npm start` works locally
- Check that `dist/` folder exists after build
- Ensure `dist/index.js` is the entry point

