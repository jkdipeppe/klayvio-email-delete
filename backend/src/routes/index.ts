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
import { canCreateRule, canEnableScheduling, getSubscriptionInfo, getSubscriptionLimits } from '../utils/subscription-limits';
import { AuthenticationRequiredError, isAuthenticationRequiredError } from '../utils/auth-errors';

const router = Router();
// Configure Prisma to disable prepared statements for connection pooling compatibility
// This is necessary when using Supabase connection pooling (port 6543)
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL?.includes('pgbouncer=true')
                ? process.env.DATABASE_URL
                : process.env.DATABASE_URL?.replace(/(\?|$)/, (match, p1) => p1 ? `${p1}&pgbouncer=true` : '?pgbouncer=true'),
        },
    },
});

/**
 * Helper function to handle authentication errors gracefully
 * Returns 401 with a specific error code that frontend can detect
 */
function handleAuthError(error: any, res: any) {
    if (isAuthenticationRequiredError(error)) {
        return res.status(401).json({
            error: error.message || 'Authentication required',
            code: 'AUTH_REQUIRED',
            requiresReauth: true
        });
    }
    return null; // Let caller handle other errors
}

// Debug endpoint to check environment variables (remove in production)
router.get('/debug-env', (req, res) => {
    res.json({
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) + '...',
        databaseUrlLength: process.env.DATABASE_URL?.length || 0,
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
    });
});

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
            const accountId = account.id; // Capture ID for TypeScript
            account = await withAccountContext(prisma, accountId, async () => {
                return await prisma.account.update({
                    where: { id: accountId },
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

        // Redirect to pricing page - it will handle navigation based on tier selection
        // If user came from pricing page with a tier selected, pricing page will redirect accordingly
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const redirectUrl = `${frontendUrl}/pricing?accountId=${account.id}`;
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

        // Check subscription limits
        const limitCheck = await canCreateRule(prisma, accountId);
        if (!limitCheck.allowed) {
            return res.status(403).json({
                error: `Rule limit reached. You have ${limitCheck.currentCount}/${limitCheck.maxRules} rules. ${limitCheck.tier === null ? 'Please subscribe to create more rules.' : 'Please upgrade to Pro plan for more rules.'}`,
                currentCount: limitCheck.currentCount,
                maxRules: limitCheck.maxRules,
                tier: limitCheck.tier,
            });
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
        const authError = handleAuthError(error, res);
        if (authError) return authError;
        res.status(500).json({ error: error.message });
    }
});

// Execute cleanup
router.post('/api/scan/:accountId/execute', async (req, res) => {
    try {
        const { profileIds } = req.body; // Optional: specific profiles to delete

        const account = await prisma.account.findUnique({
            where: { id: req.params.accountId },
            include: { subscription: true },
        });

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        // Check subscription limits for deletion
        const tier = account.subscription?.tier || null;
        const limits = getSubscriptionLimits(tier);

        // Get valid access token (refresh if needed)
        const accessToken = await getValidAccessToken(prisma, account.id);
        const client = new KlaviyoClient(accessToken);
        const scanner = new ProfileScanner(client, prisma);

        const matches = await scanner.scanProfiles(account.id);
        let toDelete = profileIds
            ? matches.filter(m => profileIds.includes(m.profileId))
            : matches;

        // Enforce max profiles per deletion limit for FREE tier
        if (limits.maxProfilesPerDeletion !== null && toDelete.length > limits.maxProfilesPerDeletion) {
            return res.status(403).json({
                error: `Free tier allows deleting up to ${limits.maxProfilesPerDeletion} profiles at a time. Please upgrade to delete more profiles.`,
                limit: limits.maxProfilesPerDeletion,
                attempted: toDelete.length,
            });
        }

        const result = await scanner.deleteMatchingProfiles(account.id, toDelete);
        res.json(result);
    } catch (error: any) {
        const authError = handleAuthError(error, res);
        if (authError) return authError;
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

// Cron endpoint - processes all due accounts (protected by API key)
// MUST be defined BEFORE /api/schedule/:accountId to avoid route conflict
router.post('/api/schedule/run', async (req, res) => {
    try {
        // Protect with API key
        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
        const expectedKey = process.env.CRON_API_KEY;

        // Log for debugging (don't log full keys in production)
        console.log('Cron endpoint called - API key check:', {
            hasApiKey: !!apiKey,
            apiKeyLength: apiKey?.length || 0,
            hasExpectedKey: !!expectedKey,
            expectedKeyLength: expectedKey?.length || 0,
            keysMatch: apiKey === expectedKey,
        });

        if (!expectedKey) {
            console.error('CRON_API_KEY not set in environment variables');
            return res.status(500).json({ error: 'Server configuration error: CRON_API_KEY not set' });
        }

        if (!apiKey || apiKey !== expectedKey) {
            console.warn('Unauthorized cron request - API key mismatch');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log('Cron job started - processing due accounts...');
        const cleanupService = new ScheduledCleanupService(prisma);
        const results = await cleanupService.processDueAccounts();

        const summary = {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            totalProfilesDeleted: results.reduce((sum, r) => sum + r.profilesDeleted, 0),
            results,
        };

        console.log(`Cron job completed - Processed ${summary.total} accounts, ${summary.successful} successful, ${summary.failed} failed`);
        res.json(summary);
    } catch (error: any) {
        console.error('Cron job error:', error);
        console.error('Error stack:', error.stack);
        // Return 500 for server errors, not 400
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

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

        // Check if scheduling is allowed (Pro plan only)
        if (isEnabled) {
            const scheduleCheck = await canEnableScheduling(prisma, accountId);
            if (!scheduleCheck.allowed) {
                return res.status(403).json({
                    error: 'Automatic scheduling is only available on the Pro plan ($7/month). Please upgrade to enable automatic cleanup.',
                    tier: scheduleCheck.tier,
                });
            }
        }

        const cleanupService = new ScheduledCleanupService(prisma);
        // Ensure frequencyDays is a valid number before calculating
        const freqDaysNum = Number(frequencyDays);
        if (isNaN(freqDaysNum) || (freqDaysNum !== 1 && freqDaysNum !== 7)) {
            return res.status(400).json({ error: 'frequencyDays must be 1 (daily) or 7 (weekly)' });
        }
        const nextRunAt = isEnabled ? cleanupService.calculateNextRunTime(freqDaysNum) : null;

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

export default router;

