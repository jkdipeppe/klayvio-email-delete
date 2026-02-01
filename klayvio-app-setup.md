# Klaviyo Spam Profile Cleanup App

A comprehensive guide to building a Klaviyo OAuth app that automatically identifies and deletes spam profiles based on configurable email patterns (prefixes/suffixes).

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Prerequisites](#prerequisites)
5. [Step-by-Step Implementation Guide](#step-by-step-implementation-guide)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Code Examples](#code-examples)
8. [Deployment](#deployment)
9. [Testing & QA](#testing--qa)
10. [Submission to Klaviyo Marketplace](#submission-to-klaviyo-marketplace)
11. [Important Considerations](#important-considerations)

---

## Overview

This app allows Klaviyo users to automatically clean up spam profiles from their account by setting rules based on email patterns. Users can define:

- **Email prefixes** to block (e.g., `noreply`, `spam`, `test`)
- **Email suffixes/domains** to block (e.g., `@tempmail.com`, `@fakeinbox.org`)

The app will scan profiles and delete those matching the configured patterns using Klaviyo's Data Privacy API.

---

## Features

| Feature | Description |
|---------|-------------|
| **OAuth Integration** | Secure authentication with Klaviyo accounts |
| **Pattern Configuration** | UI to add/remove email prefixes and suffixes |
| **Manual Scan** | On-demand scanning and deletion |
| **Scheduled Cleanup** | Automated periodic cleanup (optional) |
| **Deletion Preview** | Preview matching profiles before deletion |
| **Activity Log** | Track all deletions for compliance |
| **Rate Limit Handling** | Respect Klaviyo's API limits |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Your App Frontend                            │
│  (React/Next.js/Vue - Pattern Configuration UI)                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Your App Backend                             │
│  (Node.js/Express or Python/FastAPI)                            │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ OAuth Flow  │  │ Pattern     │  │ Profile Scanner &       │ │
│  │ Handler     │  │ Storage     │  │ Deletion Engine         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Klaviyo API                                │
│  - GET /api/profiles (fetch profiles)                           │
│  - POST /api/data-privacy-deletion-jobs (delete profiles)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### 1. Klaviyo Account Requirements

- [ ] Klaviyo account with Admin or Manager access
- [ ] Access to Klaviyo Developer Portal
- [ ] Test Klaviyo account for development

### 2. Technical Requirements

- [ ] Node.js 18+ or Python 3.9+
- [ ] Database (PostgreSQL, MySQL, or MongoDB)
- [ ] Redis (optional, for job queues)
- [ ] HTTPS-enabled domain for OAuth redirect
- [ ] Hosting platform (Vercel, Railway, AWS, etc.)

### 3. Development Tools

- [ ] Postman or similar API testing tool
- [ ] Git for version control
- [ ] Code editor (VS Code recommended)

---

## Step-by-Step Implementation Guide

### Phase 1: Klaviyo App Setup (Day 1)

#### Step 1.1: Create OAuth App in Klaviyo

1. Log into your Klaviyo account
2. Navigate to **Integrations → Developers → Manage Apps**
3. Click **Create App**
4. Fill in the app details:
   - **App Name**: "Spam Profile Cleaner" (or your chosen name)
   - **Description**: Brief description of functionality
5. **Save your Client ID and Client Secret** (you won't see the secret again!)
6. Click **Create**

#### Step 1.2: Configure OAuth Scopes

Navigate to your app settings and add these required scopes:

```
accounts:read
profiles:read
profiles:write
data-privacy:read
data-privacy:write
```

**Scope explanations:**
- `accounts:read` - Required by default
- `profiles:read` - Fetch and filter profiles
- `profiles:write` - Optional, for profile updates
- `data-privacy:read` - Check deletion status
- `data-privacy:write` - Request profile deletions

#### Step 1.3: Set Redirect URLs

Add your OAuth callback URLs:

```
# Development
http://localhost:3000/api/auth/callback/klaviyo

# Production
https://yourdomain.com/api/auth/callback/klaviyo
```

---

### Phase 2: Backend Development (Days 2-5)

#### Step 2.1: Project Setup (Node.js/Express Example)

```bash
# Create project directory
mkdir klaviyo-spam-cleaner
cd klaviyo-spam-cleaner

# Initialize npm project
npm init -y

# Install dependencies
npm install express dotenv axios prisma @prisma/client crypto-js cors helmet
npm install -D nodemon typescript @types/express @types/node

# Initialize TypeScript
npx tsc --init

# Initialize Prisma
npx prisma init
```

#### Step 2.2: Environment Configuration

Create `.env` file:

```env
# Klaviyo OAuth
KLAVIYO_CLIENT_ID=your_client_id_here
KLAVIYO_CLIENT_SECRET=your_client_secret_here
KLAVIYO_REDIRECT_URI=http://localhost:3000/api/auth/callback/klaviyo

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/klaviyo_cleaner"

# App
APP_SECRET=your_random_secret_for_encryption
PORT=3000
NODE_ENV=development
```

#### Step 2.3: Database Schema

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Account {
  id              String   @id @default(uuid())
  klaviyoAccountId String  @unique
  accessToken     String   // Encrypted
  refreshToken    String   // Encrypted
  tokenExpiresAt  DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  rules           CleanupRule[]
  deletionLogs    DeletionLog[]
}

model CleanupRule {
  id          String   @id @default(uuid())
  accountId   String
  account     Account  @relation(fields: [accountId], references: [id])
  type        RuleType
  pattern     String   // e.g., "noreply" or "@tempmail.com"
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  
  @@unique([accountId, type, pattern])
}

enum RuleType {
  PREFIX
  SUFFIX
  CONTAINS
  DOMAIN
}

model DeletionLog {
  id          String   @id @default(uuid())
  accountId   String
  account     Account  @relation(fields: [accountId], references: [id])
  profileEmail String
  profileId   String?
  ruleMatched String
  deletedAt   DateTime @default(now())
}
```

Run migration:

```bash
npx prisma migrate dev --name init
```

#### Step 2.4: OAuth Implementation

Create `src/auth/klaviyo-oauth.ts`:

```typescript
import crypto from 'crypto';
import axios from 'axios';

const KLAVIYO_AUTH_URL = 'https://www.klaviyo.com/oauth/authorize';
const KLAVIYO_TOKEN_URL = 'https://a.klaviyo.com/oauth/token';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// Generate PKCE codes (required by Klaviyo)
export function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return { codeVerifier, codeChallenge };
}

// Generate authorization URL
export function getAuthorizationUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.KLAVIYO_CLIENT_ID!,
    redirect_uri: process.env.KLAVIYO_REDIRECT_URI!,
    scope: 'accounts:read profiles:read data-privacy:read data-privacy:write',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${KLAVIYO_AUTH_URL}?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const response = await axios.post(
    KLAVIYO_TOKEN_URL,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.KLAVIYO_REDIRECT_URI!,
      code_verifier: codeVerifier,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      auth: {
        username: process.env.KLAVIYO_CLIENT_ID!,
        password: process.env.KLAVIYO_CLIENT_SECRET!,
      },
    }
  );

  return response.data;
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const response = await axios.post(
    KLAVIYO_TOKEN_URL,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      auth: {
        username: process.env.KLAVIYO_CLIENT_ID!,
        password: process.env.KLAVIYO_CLIENT_SECRET!,
      },
    }
  );

  return response.data;
}
```

#### Step 2.5: Klaviyo API Client

Create `src/services/klaviyo-client.ts`:

```typescript
import axios, { AxiosInstance } from 'axios';

const KLAVIYO_API_BASE = 'https://a.klaviyo.com/api';
const API_REVISION = '2024-10-15'; // Use latest stable revision

export class KlaviyoClient {
  private client: AxiosInstance;

  constructor(accessToken: string) {
    this.client = axios.create({
      baseURL: KLAVIYO_API_BASE,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'revision': API_REVISION,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  // Fetch all profiles with pagination
  async getAllProfiles(): Promise<any[]> {
    const profiles: any[] = [];
    let nextUrl: string | null = '/profiles/';
    
    while (nextUrl) {
      const response = await this.client.get(nextUrl, {
        params: {
          'fields[profile]': 'email,created,updated',
          'page[size]': 100,
        },
      });
      
      profiles.push(...response.data.data);
      nextUrl = response.data.links?.next || null;
      
      // Respect rate limits
      await this.sleep(100);
    }
    
    return profiles;
  }

  // Get profiles by email filter (exact match only)
  async getProfileByEmail(email: string): Promise<any | null> {
    try {
      const response = await this.client.get('/profiles/', {
        params: {
          filter: `equals(email,"${email}")`,
        },
      });
      
      return response.data.data[0] || null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }

  // Request profile deletion via Data Privacy API
  async deleteProfile(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.post('/data-privacy-deletion-jobs/', {
        data: {
          type: 'data-privacy-deletion-job',
          attributes: {
            profile: {
              data: {
                type: 'profile',
                attributes: {
                  email: email,
                },
              },
            },
          },
        },
      });
      
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.response?.data?.errors?.[0]?.detail || error.message 
      };
    }
  }

  // Rate limit helper
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### Step 2.6: Profile Scanner Service

Create `src/services/profile-scanner.ts`:

```typescript
import { PrismaClient, RuleType } from '@prisma/client';
import { KlaviyoClient } from './klaviyo-client';

interface CleanupRule {
  type: RuleType;
  pattern: string;
}

interface ScanResult {
  email: string;
  profileId: string;
  matchedRule: string;
}

export class ProfileScanner {
  private klaviyoClient: KlaviyoClient;
  private prisma: PrismaClient;

  constructor(klaviyoClient: KlaviyoClient, prisma: PrismaClient) {
    this.klaviyoClient = klaviyoClient;
    this.prisma = prisma;
  }

  // Check if email matches any rule
  matchesRule(email: string, rules: CleanupRule[]): CleanupRule | null {
    const emailLower = email.toLowerCase();
    
    for (const rule of rules) {
      const patternLower = rule.pattern.toLowerCase();
      
      switch (rule.type) {
        case 'PREFIX':
          if (emailLower.startsWith(patternLower)) {
            return rule;
          }
          break;
        case 'SUFFIX':
          if (emailLower.endsWith(patternLower)) {
            return rule;
          }
          break;
        case 'DOMAIN':
          const domain = emailLower.split('@')[1];
          if (domain === patternLower || domain?.endsWith(`.${patternLower}`)) {
            return rule;
          }
          break;
        case 'CONTAINS':
          if (emailLower.includes(patternLower)) {
            return rule;
          }
          break;
      }
    }
    
    return null;
  }

  // Scan profiles and return matches (preview mode)
  async scanProfiles(accountId: string): Promise<ScanResult[]> {
    // Fetch active rules for this account
    const rules = await this.prisma.cleanupRule.findMany({
      where: { accountId, isActive: true },
    });

    if (rules.length === 0) {
      return [];
    }

    // Fetch all profiles
    const profiles = await this.klaviyoClient.getAllProfiles();
    const matches: ScanResult[] = [];

    for (const profile of profiles) {
      const email = profile.attributes?.email;
      if (!email) continue;

      const matchedRule = this.matchesRule(email, rules);
      if (matchedRule) {
        matches.push({
          email,
          profileId: profile.id,
          matchedRule: `${matchedRule.type}: ${matchedRule.pattern}`,
        });
      }
    }

    return matches;
  }

  // Delete matching profiles
  async deleteMatchingProfiles(
    accountId: string,
    profilesToDelete: ScanResult[]
  ): Promise<{ deleted: number; failed: number; errors: string[] }> {
    const results = {
      deleted: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Rate limit: 3/s burst, 60/m steady for deletion endpoint
    const DELAY_BETWEEN_DELETIONS = 1100; // ~55 per minute to stay safe

    for (const profile of profilesToDelete) {
      const result = await this.klaviyoClient.deleteProfile(profile.email);
      
      if (result.success) {
        results.deleted++;
        
        // Log the deletion
        await this.prisma.deletionLog.create({
          data: {
            accountId,
            profileEmail: profile.email,
            profileId: profile.profileId,
            ruleMatched: profile.matchedRule,
          },
        });
      } else {
        results.failed++;
        results.errors.push(`${profile.email}: ${result.error}`);
      }

      // Respect rate limits
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DELETIONS));
    }

    return results;
  }
}
```

#### Step 2.7: Express Routes

Create `src/routes/index.ts`:

```typescript
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { 
  generatePKCE, 
  getAuthorizationUrl, 
  exchangeCodeForTokens,
  refreshAccessToken 
} from '../auth/klaviyo-oauth';
import { KlaviyoClient } from '../services/klaviyo-client';
import { ProfileScanner } from '../services/profile-scanner';
import { encrypt, decrypt } from '../utils/encryption';

const router = Router();
const prisma = new PrismaClient();

// Store PKCE codes temporarily (use Redis in production)
const pkceStore = new Map<string, string>();

// OAuth: Start authorization
router.get('/auth/klaviyo', (req, res) => {
  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = crypto.randomUUID();
  
  pkceStore.set(state, codeVerifier);
  
  const authUrl = getAuthorizationUrl(state, codeChallenge);
  res.redirect(authUrl);
});

// OAuth: Handle callback
router.get('/auth/callback/klaviyo', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/error?message=${error}`);
  }

  const codeVerifier = pkceStore.get(state as string);
  if (!codeVerifier) {
    return res.redirect('/error?message=Invalid state');
  }
  pkceStore.delete(state as string);

  try {
    const tokens = await exchangeCodeForTokens(code as string, codeVerifier);
    
    // Get account info to identify the Klaviyo account
    const client = new KlaviyoClient(tokens.access_token);
    // Note: You'd need to implement getAccountInfo or use a different identifier
    
    // Store tokens (encrypted)
    await prisma.account.upsert({
      where: { klaviyoAccountId: 'account-id-here' }, // Replace with actual account ID
      create: {
        klaviyoAccountId: 'account-id-here',
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth error:', err);
    res.redirect('/error?message=Authentication failed');
  }
});

// Get cleanup rules
router.get('/rules/:accountId', async (req, res) => {
  const rules = await prisma.cleanupRule.findMany({
    where: { accountId: req.params.accountId },
  });
  res.json(rules);
});

// Create cleanup rule
router.post('/rules/:accountId', async (req, res) => {
  const { type, pattern } = req.body;
  
  const rule = await prisma.cleanupRule.create({
    data: {
      accountId: req.params.accountId,
      type,
      pattern,
    },
  });
  
  res.json(rule);
});

// Delete cleanup rule
router.delete('/rules/:ruleId', async (req, res) => {
  await prisma.cleanupRule.delete({
    where: { id: req.params.ruleId },
  });
  res.json({ success: true });
});

// Preview scan (find matching profiles without deleting)
router.get('/scan/:accountId/preview', async (req, res) => {
  const account = await prisma.account.findUnique({
    where: { id: req.params.accountId },
  });
  
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const client = new KlaviyoClient(decrypt(account.accessToken));
  const scanner = new ProfileScanner(client, prisma);
  
  const matches = await scanner.scanProfiles(account.id);
  res.json({ matches, count: matches.length });
});

// Execute cleanup
router.post('/scan/:accountId/execute', async (req, res) => {
  const { profileIds } = req.body; // Optional: specific profiles to delete
  
  const account = await prisma.account.findUnique({
    where: { id: req.params.accountId },
  });
  
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const client = new KlaviyoClient(decrypt(account.accessToken));
  const scanner = new ProfileScanner(client, prisma);
  
  const matches = await scanner.scanProfiles(account.id);
  const toDelete = profileIds 
    ? matches.filter(m => profileIds.includes(m.profileId))
    : matches;
  
  const result = await scanner.deleteMatchingProfiles(account.id, toDelete);
  res.json(result);
});

// Get deletion history
router.get('/history/:accountId', async (req, res) => {
  const logs = await prisma.deletionLog.findMany({
    where: { accountId: req.params.accountId },
    orderBy: { deletedAt: 'desc' },
    take: 100,
  });
  res.json(logs);
});

export default router;
```

---

### Phase 3: Frontend Development (Days 6-8)

#### Step 3.1: Create React Frontend

```bash
# Create Next.js app (recommended for OAuth)
npx create-next-app@latest klaviyo-cleaner-frontend --typescript --tailwind
cd klaviyo-cleaner-frontend
npm install axios react-query
```

#### Step 3.2: Main Dashboard Component

Create `components/Dashboard.tsx`:

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';

type RuleType = 'PREFIX' | 'SUFFIX' | 'DOMAIN' | 'CONTAINS';

interface Rule {
  id: string;
  type: RuleType;
  pattern: string;
  isActive: boolean;
}

interface ScanResult {
  email: string;
  profileId: string;
  matchedRule: string;
}

export default function Dashboard({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient();
  const [newRule, setNewRule] = useState({ type: 'PREFIX' as RuleType, pattern: '' });
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());

  // Fetch rules
  const { data: rules, isLoading: rulesLoading } = useQuery<Rule[]>(
    ['rules', accountId],
    () => axios.get(`/api/rules/${accountId}`).then(res => res.data)
  );

  // Create rule mutation
  const createRule = useMutation(
    (rule: { type: RuleType; pattern: string }) =>
      axios.post(`/api/rules/${accountId}`, rule),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['rules', accountId]);
        setNewRule({ type: 'PREFIX', pattern: '' });
      },
    }
  );

  // Delete rule mutation
  const deleteRule = useMutation(
    (ruleId: string) => axios.delete(`/api/rules/${ruleId}`),
    {
      onSuccess: () => queryClient.invalidateQueries(['rules', accountId]),
    }
  );

  // Preview scan
  const previewScan = useMutation(
    () => axios.get(`/api/scan/${accountId}/preview`),
    {
      onSuccess: (res) => {
        setScanResults(res.data.matches);
        setSelectedProfiles(new Set(res.data.matches.map((m: ScanResult) => m.profileId)));
      },
    }
  );

  // Execute deletion
  const executeDeletion = useMutation(
    () => axios.post(`/api/scan/${accountId}/execute`, {
      profileIds: Array.from(selectedProfiles),
    }),
    {
      onSuccess: (res) => {
        alert(`Deleted: ${res.data.deleted}, Failed: ${res.data.failed}`);
        setScanResults([]);
        setSelectedProfiles(new Set());
      },
    }
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Spam Profile Cleaner</h1>

      {/* Add Rule Section */}
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Add Cleanup Rule</h2>
        <div className="flex gap-4">
          <select
            value={newRule.type}
            onChange={(e) => setNewRule({ ...newRule, type: e.target.value as RuleType })}
            className="border rounded px-3 py-2"
          >
            <option value="PREFIX">Email starts with</option>
            <option value="SUFFIX">Email ends with</option>
            <option value="DOMAIN">Domain equals</option>
            <option value="CONTAINS">Email contains</option>
          </select>
          <input
            type="text"
            value={newRule.pattern}
            onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
            placeholder="e.g., noreply or tempmail.com"
            className="border rounded px-3 py-2 flex-1"
          />
          <button
            onClick={() => createRule.mutate(newRule)}
            disabled={!newRule.pattern}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Add Rule
          </button>
        </div>
      </section>

      {/* Active Rules */}
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Active Rules</h2>
        {rulesLoading ? (
          <p>Loading...</p>
        ) : rules?.length === 0 ? (
          <p className="text-gray-500">No rules configured yet.</p>
        ) : (
          <ul className="space-y-2">
            {rules?.map((rule) => (
              <li key={rule.id} className="flex justify-between items-center border-b pb-2">
                <span>
                  <strong>{rule.type}:</strong> {rule.pattern}
                </span>
                <button
                  onClick={() => deleteRule.mutate(rule.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Scan Section */}
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Scan & Clean</h2>
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => previewScan.mutate()}
            disabled={previewScan.isLoading}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            {previewScan.isLoading ? 'Scanning...' : 'Preview Matches'}
          </button>
          {scanResults.length > 0 && (
            <button
              onClick={() => executeDeletion.mutate()}
              disabled={executeDeletion.isLoading || selectedProfiles.size === 0}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              {executeDeletion.isLoading 
                ? 'Deleting...' 
                : `Delete ${selectedProfiles.size} Profiles`}
            </button>
          )}
        </div>

        {/* Scan Results */}
        {scanResults.length > 0 && (
          <div className="border rounded">
            <div className="bg-gray-100 px-4 py-2 font-semibold">
              Found {scanResults.length} matching profiles
            </div>
            <div className="max-h-64 overflow-y-auto">
              {scanResults.map((result) => (
                <div
                  key={result.profileId}
                  className="flex items-center gap-3 px-4 py-2 border-t"
                >
                  <input
                    type="checkbox"
                    checked={selectedProfiles.has(result.profileId)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedProfiles);
                      if (e.target.checked) {
                        newSelected.add(result.profileId);
                      } else {
                        newSelected.delete(result.profileId);
                      }
                      setSelectedProfiles(newSelected);
                    }}
                  />
                  <span className="flex-1">{result.email}</span>
                  <span className="text-sm text-gray-500">{result.matchedRule}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
```

---

### Phase 4: Testing & Deployment (Days 9-10)

#### Step 4.1: Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] Access tokens are stored encrypted
- [ ] Token refresh works before expiration
- [ ] Rules can be created, read, updated, deleted
- [ ] Profile scanning returns correct matches
- [ ] Deletion API calls succeed
- [ ] Rate limits are respected
- [ ] Error handling works for API failures
- [ ] Uninstall flow cleans up properly

#### Step 4.2: Deploy Backend

**Option A: Railway**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

**Option B: Vercel (for Next.js full-stack)**
```bash
npm install -g vercel
vercel
```

---

## API Endpoints Reference

### Klaviyo API Endpoints Used

| Endpoint | Method | Purpose | Rate Limit |
|----------|--------|---------|------------|
| `/api/profiles/` | GET | Fetch all profiles | 75/s burst, 700/m |
| `/api/data-privacy-deletion-jobs/` | POST | Delete profile | 3/s burst, 60/m |
| `/oauth/authorize` | GET | Start OAuth | N/A |
| `/oauth/token` | POST | Exchange/refresh tokens | N/A |

### Required Scopes

| Scope | Required For |
|-------|--------------|
| `accounts:read` | Default (required) |
| `profiles:read` | Fetching profiles |
| `data-privacy:write` | Deleting profiles |

---

## Important Considerations

### Rate Limiting

The deletion endpoint has strict rate limits (3/s burst, 60/m steady). For large accounts:

1. Implement a job queue (Bull, Agenda, etc.)
2. Process deletions in background
3. Show progress to users
4. Consider batch processing over multiple days

### GDPR/CCPA Compliance

- Deletions via Data Privacy API are GDPR-compliant
- Deleted profiles appear on "Deleted Profiles" page in Klaviyo
- Keep deletion logs for compliance auditing

### API Limitations

**Important:** Klaviyo's API does not support wildcard or "contains" filtering directly. You must:

1. Fetch all profiles
2. Filter client-side using your rules
3. Delete matching profiles one by one

This can be slow for large accounts (100k+ profiles).

### Security Best Practices

1. Always encrypt stored tokens
2. Use HTTPS everywhere
3. Validate OAuth state parameter
4. Implement CSRF protection
5. Never expose client secret to frontend

---

## Submission to Klaviyo Marketplace

### Requirements Before Submission

1. **5+ Active Installs** - Get beta users to install your app
2. **Help Documentation** - Create user guides
3. **Security Assessment** - Complete Klaviyo's security form
4. **Testing Checklist** - Complete Klaviyo's testing template
5. **App Listing Assets** - Logo, screenshots, descriptions

### Submission Process

1. Navigate to your app in Manage Apps
2. Complete all required fields in app settings
3. Add listing descriptions and URLs
4. Submit for review
5. Respond to feedback from Klaviyo team

---

## Timeline Summary

| Phase | Duration | Tasks |
|-------|----------|-------|
| 1 | Day 1 | Klaviyo app setup, OAuth configuration |
| 2 | Days 2-5 | Backend development |
| 3 | Days 6-8 | Frontend development |
| 4 | Days 9-10 | Testing and deployment |
| 5 | Days 11-14 | Beta users, documentation |
| 6 | Day 15+ | Submit for marketplace review |

---

## Resources

- [Klaviyo Developer Documentation](https://developers.klaviyo.com/)
- [Create OAuth App Guide](https://developers.klaviyo.com/en/docs/create_a_public_oauth_app)
- [Data Privacy API Overview](https://developers.klaviyo.com/en/reference/data_privacy_api_overview)
- [Profiles API Reference](https://developers.klaviyo.com/en/reference/get_profiles)
- [OAuth Example App (Node.js)](https://github.com/klaviyo-labs/node-integration-example)
- [Klaviyo Academy OAuth Course](https://academy.klaviyo.com/en-us/courses/build-an-oauth-app-with-klaviyo)

---

## Support

If you encounter issues:

1. Check [Klaviyo Community Forums](https://community.klaviyo.com/)
2. Review API error responses carefully
3. Test with Postman before coding
4. Use Klaviyo's test account for development