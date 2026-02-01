import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { 
  generatePKCE, 
  getAuthorizationUrl, 
  exchangeCodeForTokens,
  refreshAccessToken 
} from '../auth/klaviyo-oauth';
import { KlaviyoClient } from '../services/klaviyo-client';
import { ProfileScanner } from '../services/profile-scanner';
import { ScheduledCleanupService } from '../services/scheduled-cleanup';
import { encrypt, decrypt } from '../utils/encryption';
import { withAccountContext } from '../utils/rls';
import { getValidAccessToken } from '../utils/token-manager';

const router = Router();
const prisma = new PrismaClient();

// Store PKCE codes temporarily (use Redis in production)
const pkceStore = new Map<string, string>();

// OAuth: Start authorization
router.get('/auth/klaviyo', (req, res) => {
  try {
    const { codeVerifier, codeChallenge } = generatePKCE();
    const state = crypto.randomUUID();
    
    pkceStore.set(state, codeVerifier);
    
    const authUrl = getAuthorizationUrl(state, codeChallenge);
    res.redirect(authUrl);
  } catch (error: any) {
    console.error('OAuth initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow', details: error.message });
  }
});

// OAuth: Handle callback
router.get('/auth/callback/klaviyo', async (req, res) => {
  const { code, state, error } = req.query;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

  if (error) {
    return res.redirect(`${frontendUrl}/error?message=${encodeURIComponent(error as string)}`);
  }

  const codeVerifier = pkceStore.get(state as string);
  if (!codeVerifier) {
    return res.redirect(`${frontendUrl}/error?message=Invalid state`);
  }
  pkceStore.delete(state as string);

  try {
    console.log('OAuth callback received, exchanging code for tokens...');
    const tokens = await exchangeCodeForTokens(code as string, codeVerifier);
    console.log('Tokens received successfully');
    
    // Get account info to identify the Klaviyo account
    const client = new KlaviyoClient(tokens.access_token);
    console.log('Fetching account info...');
    const accountInfo = await client.getAccountInfo();
    const klaviyoAccountId = accountInfo?.id || `account-${Date.now()}`;
    console.log('Account ID:', klaviyoAccountId);
    
    // Store tokens (encrypted)
    console.log('Storing account in database...');
    
    // For OAuth callback, we use upsert which handles both create and update
    // Account creation is allowed without RLS context (see RLS policy)
    // Account updates require RLS context, so we handle them separately
    let account = await prisma.account.findUnique({
      where: { klaviyoAccountId },
    });
    
    if (account) {
      // Update existing account with RLS context
      account = await withAccountContext(prisma, account.id, async () => {
        return await prisma.account.update({
          where: { id: account.id },
          data: {
            accessToken: encrypt(tokens.access_token),
            refreshToken: encrypt(tokens.refresh_token),
            tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          },
        });
      });
    } else {
      // Create new account - RLS policy allows creation without context during OAuth
      account = await prisma.account.create({
        data: {
          klaviyoAccountId,
          accessToken: encrypt(tokens.access_token),
          refreshToken: encrypt(tokens.refresh_token),
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      });
    }
    
    console.log('Account stored with ID:', account.id);

    // Redirect to frontend dashboard
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const redirectUrl = `${frontendUrl}/dashboard?accountId=${account.id}`;
    console.log(`OAuth success! Redirecting to: ${redirectUrl}`);
    // Use 302 temporary redirect to ensure browser follows it
    res.status(302).redirect(redirectUrl);
  } catch (err: any) {
    console.error('OAuth error:', err);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/error?message=${encodeURIComponent(err.message || 'Authentication failed')}`);
  }
});

// Get cleanup rules
router.get('/api/rules/:accountId', async (req, res) => {
  try {
    const accountId = req.params.accountId;
    
    // Verify account exists and user has access
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Use RLS context to ensure user can only access their own rules
    const rules = await withAccountContext(prisma, accountId, async () => {
      return await prisma.cleanupRule.findMany({
        where: { accountId },
      });
    });
    
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create cleanup rule
router.post('/api/rules/:accountId', async (req, res) => {
  try {
    const accountId = req.params.accountId;
    const { type, pattern } = req.body;
    
    if (!type || !pattern) {
      return res.status(400).json({ error: 'Type and pattern are required' });
    }
    
    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Use RLS context
    const rule = await withAccountContext(prisma, accountId, async () => {
      return await prisma.cleanupRule.create({
        data: {
          accountId,
          type,
          pattern,
        },
      });
    });
    
    res.json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete cleanup rule
router.delete('/api/rules/:ruleId', async (req, res) => {
  try {
    const ruleId = req.params.ruleId;
    
    // First get the rule to find the accountId
    const rule = await prisma.cleanupRule.findUnique({
      where: { id: ruleId },
      select: { accountId: true },
    });
    
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    // Use RLS context to ensure user can only delete their own rules
    await withAccountContext(prisma, rule.accountId, async () => {
      await prisma.cleanupRule.delete({
        where: { id: ruleId },
      });
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Preview scan (find matching profiles without deleting)
router.get('/api/scan/:accountId/preview', async (req, res) => {
  try {
    const account = await prisma.account.findUnique({
      where: { id: req.params.accountId },
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get valid access token (refresh if needed)
    const accessToken = await getValidAccessToken(prisma, account.id);
    const client = new KlaviyoClient(accessToken);
    const scanner = new ProfileScanner(client, prisma);
    
    const matches = await scanner.scanProfiles(account.id);
    res.json({ matches, count: matches.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Execute cleanup
router.post('/api/scan/:accountId/execute', async (req, res) => {
  try {
    const { profileIds } = req.body; // Optional: specific profiles to delete
    
    const account = await prisma.account.findUnique({
      where: { id: req.params.accountId },
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get valid access token (refresh if needed)
    const accessToken = await getValidAccessToken(prisma, account.id);
    const client = new KlaviyoClient(accessToken);
    const scanner = new ProfileScanner(client, prisma);
    
    const matches = await scanner.scanProfiles(account.id);
    const toDelete = profileIds 
      ? matches.filter(m => profileIds.includes(m.profileId))
      : matches;
    
    const result = await scanner.deleteMatchingProfiles(account.id, toDelete);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get deletion history
router.get('/api/history/:accountId', async (req, res) => {
  try {
    const accountId = req.params.accountId;
    
    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Use RLS context
    const logs = await withAccountContext(prisma, accountId, async () => {
      return await prisma.deletionLog.findMany({
        where: { accountId },
        orderBy: { deletedAt: 'desc' },
        take: 100,
      });
    });
    
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Scheduled Cleanup Endpoints ====================

// Get schedule configuration
router.get('/api/schedule/:accountId', async (req, res) => {
  try {
    const accountId = req.params.accountId;
    
    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Get schedule with RLS context
    const schedule = await withAccountContext(prisma, accountId, async () => {
      return await prisma.scheduledCleanup.findUnique({
        where: { accountId },
      });
    });
    
    // If no schedule exists, return default
    if (!schedule) {
      return res.json({
        isEnabled: false,
        frequencyDays: 7,
        lastRunAt: null,
        nextRunAt: null,
      });
    }
    
    res.json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create or update schedule
router.post('/api/schedule/:accountId', async (req, res) => {
  try {
    const accountId = req.params.accountId;
    const { isEnabled, frequencyDays } = req.body;
    
    // Validate frequency
    if (frequencyDays !== 1 && frequencyDays !== 7) {
      return res.status(400).json({ error: 'frequencyDays must be 1 (daily) or 7 (weekly)' });
    }
    
    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const cleanupService = new ScheduledCleanupService(prisma);
    const nextRunAt = isEnabled ? cleanupService.calculateNextRunTime(frequencyDays) : null;
    
    // Upsert schedule with RLS context
    const schedule = await withAccountContext(prisma, accountId, async () => {
      return await prisma.scheduledCleanup.upsert({
        where: { accountId },
        create: {
          accountId,
          isEnabled: Boolean(isEnabled),
          frequencyDays: parseInt(frequencyDays),
          nextRunAt,
        },
        update: {
          isEnabled: Boolean(isEnabled),
          frequencyDays: parseInt(frequencyDays),
          nextRunAt: isEnabled ? nextRunAt : null,
        },
      });
    });
    
    res.json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger cleanup for an account
router.post('/api/schedule/:accountId/run', async (req, res) => {
  try {
    const accountId = req.params.accountId;
    
    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const cleanupService = new ScheduledCleanupService(prisma);
    const result = await cleanupService.processAccount(accountId);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error, ...result });
    }
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get cleanup run history
router.get('/api/schedule/:accountId/history', async (req, res) => {
  try {
    const accountId = req.params.accountId;
    
    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Get run history with RLS context
    const runs = await withAccountContext(prisma, accountId, async () => {
      return await prisma.cleanupRun.findMany({
        where: { accountId },
        orderBy: { startedAt: 'desc' },
        take: 20,
      });
    });
    
    res.json(runs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cron endpoint - processes all due accounts (protected by API key)
router.post('/api/schedule/run', async (req, res) => {
  try {
    // Protect with API key
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    const expectedKey = process.env.CRON_API_KEY;
    
    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const cleanupService = new ScheduledCleanupService(prisma);
    const results = await cleanupService.processDueAccounts();
    
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalProfilesDeleted: results.reduce((sum, r) => sum + r.profilesDeleted, 0),
      results,
    };
    
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

