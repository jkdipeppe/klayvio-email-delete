# Backend Setup

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

```env
# Klaviyo OAuth
KLAVIYO_CLIENT_ID=your_client_id_here
KLAVIYO_CLIENT_SECRET=your_client_secret_here
KLAVIYO_REDIRECT_URI=http://localhost:3000/auth/callback/klaviyo

# Database
# Option 1: Supabase (recommended)
# Format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
# Option 2: Local PostgreSQL
# Format: postgresql://user:password@localhost:5432/klaviyo_cleaner
DATABASE_URL="your_database_connection_string_here"

# App
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Or: openssl rand -hex 32
APP_SECRET=your_random_secret_for_encryption
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
```

## Database Setup

### Using Supabase (Recommended)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database** and copy the connection string
3. Add it to your `.env` file as `DATABASE_URL`
4. Run migrations:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### Using Local PostgreSQL

1. Make sure PostgreSQL is running
2. Create a database:
```sql
CREATE DATABASE klaviyo_cleaner;
```

3. Run migrations:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

## Running the Server

Development mode (with hot reload):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## API Endpoints

- `GET /health` - Health check
- `GET /auth/klaviyo` - Start OAuth flow
- `GET /auth/callback/klaviyo` - OAuth callback
- `GET /api/rules/:accountId` - Get rules
- `POST /api/rules/:accountId` - Create rule
- `DELETE /api/rules/:ruleId` - Delete rule
- `GET /api/scan/:accountId/preview` - Preview scan
- `POST /api/scan/:accountId/execute` - Execute deletion
- `GET /api/history/:accountId` - Get deletion history

