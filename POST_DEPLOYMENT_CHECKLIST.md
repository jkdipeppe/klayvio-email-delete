# Post-Deployment Checklist

## ✅ Deployment Complete!

Both Vercel (frontend) and Railway (backend) have been successfully deployed.

## 🔧 Required Configuration Steps

### 1. Environment Variables

#### Railway (Backend)
Make sure these are set in Railway → Your Service → Variables:

```env
NODE_ENV=production
PORT=3000
KLAVIYO_CLIENT_ID=your_production_client_id
KLAVIYO_CLIENT_SECRET=your_production_client_secret
KLAVIYO_REDIRECT_URI=https://your-frontend-url.vercel.app/auth/callback/klaviyo
DATABASE_URL=your_supabase_connection_string
APP_SECRET=your_encryption_secret
FRONTEND_URL=https://your-frontend-url.vercel.app
CRON_API_KEY=your_secure_random_string
```

#### Vercel (Frontend)
Make sure these are set in Vercel → Your Project → Settings → Environment Variables:

```env
BACKEND_URL=https://your-backend-url.railway.app
CRON_SECRET=your_secure_random_string (must match CRON_API_KEY or be different - see cron setup)
CRON_API_KEY=your_secure_random_string (must match backend CRON_API_KEY)
```

**Important**: 
- `BACKEND_URL` should be your Railway backend URL (e.g., `https://klayvio-email-delete-production.up.railway.app`)
- Make sure it includes `https://` protocol

### 2. Update Klaviyo OAuth Settings

1. Go to [Klaviyo App Management](https://www.klaviyo.com/settings/api-keys)
2. Find your app
3. Add production redirect URI:
   ```
   https://your-frontend-url.vercel.app/auth/callback/klaviyo
   ```
4. Save changes

### 3. Run Database Migrations

If you haven't already, run Prisma migrations in Supabase:

**Option A: Via Supabase SQL Editor**
1. Go to Supabase Dashboard → SQL Editor
2. Run the migration files from `backend/prisma/migrations/`
3. Make sure to run `enable_rls.sql` for Row Level Security

**Option B: Via Railway CLI**
```bash
railway run npx prisma migrate deploy
```

### 4. Set Up Vercel Cron Jobs

If you want scheduled cleanup to run automatically:

1. **Verify cron endpoint exists**: Check that `/api/cron/schedule-run` is accessible
2. **Set CRON_SECRET**: In Vercel environment variables, set `CRON_SECRET` to a secure random string
3. **Verify cron schedule**: Check `frontend/vercel.json` has the cron configuration:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/schedule-run",
         "schedule": "0 * * * *"
       }
     ]
   }
   ```
4. **Test manually**: Visit `https://your-frontend-url.vercel.app/api/cron/schedule-run` with proper auth header to test

### 5. Test the Application

1. **OAuth Flow**:
   - Visit your Vercel frontend URL
   - Click "Connect with Klaviyo"
   - Complete OAuth flow
   - Should redirect to dashboard

2. **Dashboard**:
   - Create a cleanup rule
   - Test preview scan
   - Test manual deletion

3. **Scheduled Cleanup**:
   - Enable scheduled cleanup in dashboard
   - Set frequency (24h or 7 days)
   - Test manual trigger
   - Verify cron job runs (check logs)

## 🔍 Verification Steps

### Backend Health Check
```bash
curl https://your-backend-url.railway.app/api/health
# (if you have a health endpoint)
```

### Frontend Health Check
Visit: `https://your-frontend-url.vercel.app`

### Cron Job Test
```bash
curl -X POST https://your-frontend-url.vercel.app/api/cron/schedule-run \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 📝 Important Notes

1. **HTTPS Only**: Make sure all URLs use `https://` in production
2. **CORS**: Backend CORS should allow your Vercel domain
3. **Database**: Ensure Supabase RLS is enabled for multi-tenant security
4. **Tokens**: OAuth tokens are encrypted in the database
5. **Rate Limiting**: Klaviyo API has rate limits - the app handles this automatically

## 🐛 Troubleshooting

### OAuth Redirect Issues
- Verify redirect URI matches exactly in Klaviyo settings
- Check `KLAVIYO_REDIRECT_URI` in Railway matches frontend URL

### API Connection Issues
- Verify `BACKEND_URL` in Vercel includes `https://`
- Check CORS settings in backend
- Verify backend is running (check Railway logs)

### Cron Job Not Running
- Verify `CRON_SECRET` matches in Vercel cron handler
- Check Vercel cron logs
- Verify `CRON_API_KEY` matches between Vercel and Railway

### Database Issues
- Verify `DATABASE_URL` is set correctly
- Check RLS policies are enabled
- Verify migrations have run

## 🎉 Next Steps

Once everything is configured:

1. **Test with real Klaviyo account**
2. **Monitor logs** for any errors
3. **Set up monitoring/alerts** (optional)
4. **Document your specific URLs** for future reference

## 📚 Documentation References

- `DEPLOYMENT.md` - Full deployment guide
- `VERCEL_CRON_QUICK_START.md` - Cron job setup
- `RAILWAY_FIX.md` - Railway configuration
- `VERCEL_DEPLOYMENT_FIX.md` - Vercel configuration
- `RLS_SETUP.md` - Database security setup

