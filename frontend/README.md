# Frontend Setup

## Environment Variables

Create a `.env.local` file in the frontend directory:

```env
BACKEND_URL=http://localhost:3000
```

## Running the Development Server

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3001` (or next available port).

## Building for Production

```bash
npm run build
npm start
```

## Pages

- `/` - Home page with Klaviyo connect button
- `/dashboard` - Main dashboard (requires accountId query param)
- `/error` - Error page for OAuth failures

