# Quick Setup Guide

Follow these steps to get the Klaviyo Spam Profile Cleaner app running locally.

## Step 1: Prerequisites

- Node.js 18+ installed
- Database: [Supabase](https://supabase.com) account (recommended) OR local PostgreSQL
- Klaviyo account with Developer access

## Step 2: Database Setup

### Option A: Supabase (Recommended for Quick Setup)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **Settings → Database**
4. Copy the **Connection String** (URI format)
5. Use this as your `DATABASE_URL` in the backend `.env` file
   - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
   - Replace `[YOUR-PASSWORD]` with your database password
   - Replace `[PROJECT-REF]` with your project reference

### Option B: Local PostgreSQL

1. Install PostgreSQL if not already installed
2. Create a database:
```bash
createdb klaviyo_cleaner
# Or using psql:
# CREATE DATABASE klaviyo_cleaner;
```

## Step 3: Klaviyo App Configuration

1. Log into Klaviyo
2. Go to **Integrations → Developers → Manage Apps**
3. Click **Create App**
4. Set app name: "Spam Profile Cleaner"
5. Add redirect URI: `http://localhost:3000/auth/callback/klaviyo`
6. Add scopes:
   - `accounts:read`
   - `profiles:read`
   - `data-privacy:read`
   - `data-privacy:write`
7. Save your **Client ID** and **Client Secret**

## Step 4: Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:
```env
KLAVIYO_CLIENT_ID=your_client_id_here
KLAVIYO_CLIENT_SECRET=your_client_secret_here
KLAVIYO_REDIRECT_URI=http://localhost:3000/auth/callback/klaviyo

# Database - Use Supabase connection string or local PostgreSQL
# Supabase format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
# Local format: postgresql://user:password@localhost:5432/klaviyo_cleaner
DATABASE_URL="your_database_connection_string_here"

# Generate a random secret (see below for methods)
APP_SECRET=generate_a_random_secret_here
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
```

**To generate APP_SECRET**, use one of these methods:

**Option 1: Using Node.js (recommended)**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 2: Using OpenSSL**
```bash
openssl rand -hex 32
```

**Option 3: Using Python**
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Option 4: Online generator**
- Visit https://randomkeygen.com/ and use a "CodeIgniter Encryption Keys" or similar
- Or use: https://generate-secret.vercel.app/32

Copy the generated string and replace `generate_a_random_secret_here` in your `.env` file.

Initialize database:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

Start backend:
```bash
npm run dev
```

Backend will run on `http://localhost:3000`

## Step 5: Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
```

Create `.env.local` file:
```env
BACKEND_URL=http://localhost:3000
```

Start frontend:
```bash
npm run dev
```

Frontend will run on `http://localhost:3001` (or next available port)

## Step 6: Test the App

1. Open `http://localhost:3001` in your browser
2. Click "Connect with Klaviyo"
3. Authorize the app in Klaviyo
4. You'll be redirected to the dashboard
5. Add cleanup rules (e.g., prefix "noreply" or domain "tempmail.com")
6. Click "Preview Matches" to see matching profiles
7. Select profiles and click "Delete" to remove them

## Troubleshooting

### Database Connection Issues
- **Supabase**: Verify your connection string includes the correct password and project reference
- **Local PostgreSQL**: Make sure PostgreSQL is running
- Verify DATABASE_URL in `.env` is correct (should start with `postgresql://`)
- Test connection: `psql "your_database_url"` (Supabase) or `psql -l | grep klaviyo_cleaner` (local)

### OAuth Issues
- Verify redirect URI matches exactly in Klaviyo app settings
- Check Client ID and Secret are correct in `.env`
- Check browser console for errors

### API Connection Issues
- Make sure backend is running on port 3000
- Verify BACKEND_URL in frontend `.env.local`
- Check Next.js rewrites in `next.config.js`

## Next Steps

- Review `klayvio-app-setup.md` for detailed implementation guide
- Test with a small Klaviyo account first
- Review rate limiting considerations before production use

