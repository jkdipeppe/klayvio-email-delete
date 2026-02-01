# Production Deployment Guide

This guide walks you through deploying the Klaviyo Spam Profile Cleaner app to production.

## Architecture Overview

```
┌─────────────────┐
│   Frontend      │  (Vercel/Netlify)
│   Next.js       │  https://yourdomain.com
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Backend       │  (Railway/Render)
│   Express API   │  https://api.yourdomain.com
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Database      │  (Supabase)
│   PostgreSQL    │
└─────────────────┘
```

## Prerequisites

- [ ] GitHub account (for code hosting)
- [ ] Supabase account (database)
- [ ] Klaviyo app created with production redirect URI
- [ ] Domain name (optional but recommended)

---

## Step 1: Prepare Your Code

### 1.1 Create GitHub Repository

```bash
# In your project directory
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/klaviyo-spam-cleaner.git
git push -u origin main
```

### 1.2 Update .gitignore

Make sure `.gitignore` includes:
```
.env
.env.local
.env*.local
node_modules/
dist/
```

---

## Step 2: Deploy Backend (Railway - Recommended)

Railway is great for Node.js apps with PostgreSQL support.

### 2.1 Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project"

### 2.2 Deploy Backend

1. Click "Deploy from GitHub repo"
2. Select your repository
3. Railway will create a service - **don't deploy yet!**
4. **IMPORTANT**: Go to **Settings** → **Source**
5. Set **Root Directory** to: `backend`
6. Save changes
7. Railway will auto-detect Node.js and deploy

### 2.3 Configure Environment Variables

In Railway project settings, add these variables:

```env
NODE_ENV=production
PORT=3000
KLAVIYO_CLIENT_ID=your_production_client_id
KLAVIYO_CLIENT_SECRET=your_production_client_secret
KLAVIYO_REDIRECT_URI=https://api.yourdomain.com/auth/callback/klaviyo
DATABASE_URL=your_supabase_connection_string
APP_SECRET=your_production_secret_here
FRONTEND_URL=https://yourdomain.com
```

**Important**: Generate a new `APP_SECRET` for production:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.4 Configure Build Settings

**Important**: Railway needs to know the backend is in a subdirectory.

**Option A: Railway Dashboard (Recommended)**
1. In Railway, go to your backend service
2. Click **Settings** tab
3. Scroll to **Source** section
4. Set **Root Directory**: `backend`
5. Railway will auto-detect Node.js and build commands

**Option B: Use railway.toml**
The `railway.toml` file in the root configures this automatically.

### 2.5 Run Database Migrations

Railway provides a PostgreSQL database, but we're using Supabase. You can:

**Option A: Use Railway's PostgreSQL** (simpler, but separate from Supabase)
- Railway will provide a `DATABASE_URL` automatically
- Run migrations: `railway run npx prisma migrate deploy`

**Option B: Use Supabase** (recommended - already set up)
- Use your Supabase connection string
- Run migrations in Supabase SQL Editor or via CLI

### 2.6 Get Backend URL

After deployment, Railway will provide a URL like:
```
https://your-app-name.up.railway.app
```

Note this URL - you'll need it for the frontend.

---

## Step 3: Deploy Frontend (Vercel - Recommended)

Vercel is perfect for Next.js apps.

### 3.1 Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "Add New Project"

### 3.2 Deploy Frontend

1. Import your GitHub repository
2. **IMPORTANT**: Before deploying, go to **Settings** → **General**
3. Set **Root Directory** to: `frontend`
4. Save changes
5. Vercel will auto-detect Next.js and configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)

### 3.3 Configure Environment Variables

In Vercel project settings → Environment Variables, add:

```env
BACKEND_URL=https://your-app-name.up.railway.app
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### 3.4 Configure Next.js Rewrites

The `next.config.js` already has rewrites configured. Make sure it uses the environment variable:

```js
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: `${process.env.BACKEND_URL}/api/:path*`,
    },
    {
      source: '/auth/:path*',
      destination: `${process.env.BACKEND_URL}/auth/:path*`,
    },
  ];
}
```

### 3.5 Get Frontend URL

Vercel will provide a URL like:
```
https://your-app-name.vercel.app
```

---

## Step 4: Configure Custom Domain (Optional)

### 4.1 Backend Domain (Railway)

1. In Railway project → Settings → Domains
2. Add custom domain: `api.yourdomain.com`
3. Follow DNS instructions to add CNAME record
4. Update `KLAVIYO_REDIRECT_URI` to use new domain

### 4.2 Frontend Domain (Vercel)

1. In Vercel project → Settings → Domains
2. Add domain: `yourdomain.com`
3. Follow DNS instructions
4. Update `FRONTEND_URL` and `NEXT_PUBLIC_APP_URL` in both Railway and Vercel

---

## Step 5: Update Klaviyo App Settings

1. Go to Klaviyo → Integrations → Developers → Manage Apps
2. Edit your app
3. Update Redirect URI to:
   ```
   https://api.yourdomain.com/auth/callback/klaviyo
   ```
   (or Railway URL if not using custom domain)
4. Save changes

---

## Step 6: Run Database Migrations

### Option A: Via Supabase SQL Editor

1. Go to Supabase Dashboard → SQL Editor
2. Run the RLS migration: `backend/prisma/migrations/enable_rls.sql`
3. Verify RLS is enabled

### Option B: Via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migrations
railway run npx prisma migrate deploy
```

---

## Step 7: Verify Deployment

### 7.1 Test Backend

```bash
# Health check
curl https://api.yourdomain.com/health

# Should return: {"status":"ok"}
```

### 7.2 Test Frontend

1. Visit `https://yourdomain.com`
2. Click "Connect with Klaviyo"
3. Complete OAuth flow
4. Verify dashboard loads

### 7.3 Test Database

1. Create a cleanup rule
2. Run a preview scan
3. Verify data is saved correctly

---

## Alternative Deployment Options

### Backend Alternatives

**Render** (render.com)
- Similar to Railway
- Free tier available
- Good PostgreSQL support

**Fly.io** (fly.io)
- Global edge deployment
- Good for low latency
- More complex setup

**Heroku** (heroku.com)
- Classic platform
- Paid plans only
- Easy setup

### Frontend Alternatives

**Netlify** (netlify.com)
- Great for static sites
- Good Next.js support
- Free tier available

**Cloudflare Pages** (pages.cloudflare.com)
- Fast CDN
- Free tier
- Good for static sites

---

## Environment Variables Checklist

### Backend (Railway)
- [ ] `NODE_ENV=production`
- [ ] `PORT=3000`
- [ ] `KLAVIYO_CLIENT_ID`
- [ ] `KLAVIYO_CLIENT_SECRET`
- [ ] `KLAVIYO_REDIRECT_URI` (production URL)
- [ ] `DATABASE_URL` (Supabase connection string)
- [ ] `APP_SECRET` (new production secret)
- [ ] `FRONTEND_URL` (production frontend URL)

### Frontend (Vercel)
- [ ] `BACKEND_URL` (production backend URL)
- [ ] `NEXT_PUBLIC_APP_URL` (production frontend URL)

---

## Post-Deployment Checklist

- [ ] Backend health check works
- [ ] Frontend loads correctly
- [ ] OAuth flow completes successfully
- [ ] Database migrations applied
- [ ] RLS policies enabled
- [ ] Environment variables set correctly
- [ ] Custom domains configured (if using)
- [ ] SSL certificates active (automatic on Railway/Vercel)
- [ ] Error monitoring set up (optional)
- [ ] Logs accessible

---

## Monitoring & Maintenance

### View Logs

**Railway (Backend)**
- Go to project → Deployments → Click deployment → View logs

**Vercel (Frontend)**
- Go to project → Deployments → Click deployment → View logs

### Update Application

1. Make changes locally
2. Commit and push to GitHub
3. Railway/Vercel will auto-deploy
4. Monitor deployment logs

### Database Backups

Supabase automatically backs up your database. You can also:
- Export data via Supabase Dashboard
- Use `pg_dump` for manual backups

---

## Troubleshooting

### Backend won't start
- Check environment variables are set
- Verify `DATABASE_URL` is correct
- Check build logs for errors

### OAuth redirect fails
- Verify `KLAVIYO_REDIRECT_URI` matches Klaviyo app settings
- Check backend logs for errors
- Ensure HTTPS is used (required by Klaviyo)

### Database connection errors
- Verify `DATABASE_URL` is correct
- Check Supabase connection pooling settings
- Ensure IP is whitelisted (if required)

### Frontend can't reach backend
- Verify `BACKEND_URL` is set correctly
- Check CORS settings on backend
- Verify Next.js rewrites are configured

---

## Cost Estimates

### Free Tier (Good for testing)
- **Railway**: $5/month (after free trial)
- **Vercel**: Free (with limitations)
- **Supabase**: Free tier available
- **Total**: ~$5/month

### Production Tier
- **Railway**: $20/month
- **Vercel**: Free (or Pro $20/month)
- **Supabase**: $25/month (Pro)
- **Total**: ~$45-65/month

---

## Security Checklist

- [ ] All environment variables set in production
- [ ] `APP_SECRET` is unique and strong
- [ ] HTTPS enabled (automatic on Railway/Vercel)
- [ ] CORS configured to only allow frontend domain
- [ ] RLS enabled on database
- [ ] No secrets committed to git
- [ ] Database credentials secured
- [ ] Rate limiting configured (if needed)

---

## Next Steps

1. Set up error monitoring (Sentry, LogRocket, etc.)
2. Configure analytics (if needed)
3. Set up CI/CD for automated testing
4. Create backup strategy
5. Document API endpoints for your team
6. Set up alerts for downtime

---

## Support

If you encounter issues:
1. Check deployment logs
2. Verify environment variables
3. Test locally first
4. Check platform status pages
5. Review error messages carefully

