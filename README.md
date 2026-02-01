# Klaviyo Spam Profile Cleanup App

A comprehensive Klaviyo OAuth app that automatically identifies and deletes spam profiles based on configurable email patterns (prefixes/suffixes).

## Project Structure

```
klayvio-email-delete/
├── backend/          # Express/TypeScript backend
│   ├── src/
│   │   ├── auth/     # OAuth implementation
│   │   ├── services/ # Klaviyo API client & profile scanner
│   │   ├── routes/   # API routes
│   │   └── utils/    # Utility functions
│   └── prisma/       # Database schema
├── frontend/         # Next.js frontend
│   ├── pages/        # Next.js pages
│   └── components/   # React components
└── klayvio-app-setup.md  # Detailed setup guide
```

## Quick Start

### Prerequisites

- Node.js 18+
- Database: PostgreSQL (local) or [Supabase](https://supabase.com) (recommended)
- Klaviyo account with Developer access

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Create .env file (see backend/README.md for Supabase setup)
# Edit .env with your Klaviyo credentials and database URL
# For Supabase: Use connection string from Settings → Database
# Format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

4. Set up database:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

5. Start the backend server:
```bash
npm run dev
```

The backend will run on `http://localhost:3000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3001` (or next available port)

### Klaviyo App Configuration

1. Log into your Klaviyo account
2. Navigate to **Integrations → Developers → Manage Apps**
3. Create a new OAuth app
4. Configure the following:
   - **Redirect URI**: `http://localhost:3000/auth/callback/klaviyo` (development)
   - **Scopes**: 
     - `accounts:read`
     - `profiles:read`
     - `data-privacy:read`
     - `data-privacy:write`
5. Copy the Client ID and Client Secret to your `.env` file

## Features

- ✅ OAuth Integration with Klaviyo
- ✅ Pattern-based profile matching (prefix, suffix, domain, contains)
- ✅ Preview scan before deletion
- ✅ Batch deletion with rate limiting
- ✅ Deletion history logging
- ✅ Secure token encryption

## API Endpoints

### Authentication
- `GET /auth/klaviyo` - Start OAuth flow
- `GET /auth/callback/klaviyo` - OAuth callback handler

### Rules Management
- `GET /api/rules/:accountId` - Get all rules for an account
- `POST /api/rules/:accountId` - Create a new rule
- `DELETE /api/rules/:ruleId` - Delete a rule

### Profile Scanning
- `GET /api/scan/:accountId/preview` - Preview matching profiles
- `POST /api/scan/:accountId/execute` - Execute deletion

### History
- `GET /api/history/:accountId` - Get deletion history

## Development

### Backend Commands
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run prisma:studio` - Open Prisma Studio

### Frontend Commands
- `npm run dev` - Start Next.js development server
- `npm run build` - Build for production
- `npm start` - Start production server

## Important Notes

1. **Rate Limiting**: The deletion endpoint has strict rate limits (3/s burst, 60/m steady). The app respects these limits automatically.

2. **Token Security**: Access tokens are encrypted before storage using AES encryption.

3. **Database**: Uses PostgreSQL with Prisma ORM. Works with Supabase (recommended) or local PostgreSQL. Make sure your database is accessible before starting the backend.

4. **OAuth Redirect**: Update the redirect URI in both Klaviyo app settings and `.env` file to match your deployment URL.

## Deployment

See `klayvio-app-setup.md` for detailed deployment instructions for Railway, Vercel, or other platforms.

## License

ISC

