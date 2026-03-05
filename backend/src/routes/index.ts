import express, { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import {
    generatePKCE,
    getAuthorizationUrl,
    exchangeCodeForTokens,
    refreshAccessToken,
    revokeToken
} from '../auth/klaviyo-oauth';
import {
    getGoogleAuthUrl,
    exchangeGoogleCodeForTokens,
    getGoogleProfile,
    generateState as generateGoogleState,
} from '../auth/google-oauth';
import { signToken, verifyToken } from '../auth/jwt';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
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
 * Returns 401 with a specific error code that frontend can detect.
 * KLAVIYO_RECONNECT = Klaviyo tokens invalid (e.g. decryption failed); user should reconnect Klaviyo only, not log out.
 */
function handleAuthError(error: any, res: any) {
    if (!isAuthenticationRequiredError(error)) return null;
    const msg = error.message || 'Authentication required';
    const isKlaviyoReconnect = msg.includes('Decryption failed') || msg.includes('Klaviyo connection has expired');
    return res.status(401).json({
        error: msg,
        code: isKlaviyoReconnect ? 'KLAVIYO_RECONNECT' : 'AUTH_REQUIRED',
        requiresReauth: true,
    });
}

// Debug endpoint – only available in development (never expose in production)
router.get('/debug-env', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    res.json({
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
    });
});

const auth = authMiddleware(prisma);

// Parse JWT on all requests (does not block)
router.use(auth.parseAuth);

// ----- Google OAuth (primary login) -----
const googleStateStore = new Map<string, boolean>();
// One-time codes for token exchange (avoids sending JWT in URL). Code -> { token, expiresAt }
const CODE_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes
const loginCodeStore = new Map<string, { token: string; expiresAt: number }>();

function createLoginCode(token: string): string {
    const code = crypto.randomBytes(24).toString('base64url');
    loginCodeStore.set(code, { token, expiresAt: Date.now() + CODE_EXPIRY_MS });
    return code;
}

function consumeLoginCode(code: string): string | null {
    const entry = loginCodeStore.get(code);
    loginCodeStore.delete(code);
    if (!entry || Date.now() > entry.expiresAt) return null;
    return entry.token;
}

router.get('/auth/google', (req, res) => {
    try {
        const state = generateGoogleState();
        googleStateStore.set(state, true);
        const url = getGoogleAuthUrl(state);
        res.redirect(url);
    } catch (error: any) {
        console.error('Google OAuth error:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        res.redirect(`${frontendUrl}/?error=google_oauth&message=${encodeURIComponent(error.message || 'Login failed')}`);
    }
});

router.get('/auth/callback/google', async (req, res) => {
    const { code, state, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    if (error) {
        return res.redirect(`${frontendUrl}/?error=google_denied&message=${encodeURIComponent((error as string) || 'Access denied')}`);
    }
    if (!googleStateStore.has(state as string)) {
        return res.redirect(`${frontendUrl}/?error=invalid_state`);
    }
    googleStateStore.delete(state as string);

    try {
        const tokens = await exchangeGoogleCodeForTokens(code as string);
        const profile = await getGoogleProfile(tokens.access_token);
        let user = await prisma.user.findUnique({ where: { googleId: profile.id } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    googleId: profile.id,
                    email: profile.email,
                    name: profile.name ?? null,
                    picture: profile.picture ?? null,
                },
            });
        } else {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { name: profile.name ?? null, picture: profile.picture ?? null },
            });
        }
        const token = signToken({ userId: user.id, email: user.email });
        // Redirect with one-time code instead of JWT so the token never appears in URL/history/referrer
        const oneTimeCode = createLoginCode(token);
        res.redirect(`${frontendUrl}/auth/callback?code=${encodeURIComponent(oneTimeCode)}`);
    } catch (err: any) {
        console.error('Google callback error:', err);
        res.redirect(`${frontendUrl}/?error=google_callback&message=${encodeURIComponent(err.message || 'Login failed')}`);
    }
});

// Exchange one-time login code for JWT (called by frontend after OAuth redirect)
router.post('/auth/exchange-token', (req, res) => {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : null;
    if (!code) {
        return res.status(400).json({ error: 'Missing or invalid code', code: 'INVALID_CODE' });
    }
    const token = consumeLoginCode(code);
    if (!token) {
        return res.status(400).json({ error: 'Invalid or expired code. Please sign in again.', code: 'INVALID_CODE' });
    }
    res.json({ token });
});

// ----- Session: current user and linked Klaviyo account -----
router.get('/api/me', auth.requireAuth, async (req: AuthRequest, res) => {
    try {
        const account = await prisma.account.findFirst({
            where: { userId: req.userId! },
            select: { id: true },
        });
        res.json({
            user: req.user,
            accountId: account?.id ?? null,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ----- Klaviyo OAuth (connect after login). Requires logged-in user. -----
const pkceStore = new Map<string, string>();
const klaviyoStateToUserId = new Map<string, string>();

function startKlaviyoRedirect(req: AuthRequest, res: express.Response) {
    try {
        const { codeVerifier, codeChallenge } = generatePKCE();
        const state = crypto.randomUUID();
        pkceStore.set(state, codeVerifier);
        klaviyoStateToUserId.set(state, req.userId!);
        const authUrl = getAuthorizationUrl(state, codeChallenge);
        res.redirect(authUrl);
    } catch (error: any) {
        console.error('OAuth initiation error:', error);
        res.status(500).json({ error: 'Failed to initiate OAuth flow', details: error.message });
    }
}

// GET /auth/klaviyo — handles two cases:
//   1. If the user is already authenticated (Bearer token in header), kick off the OAuth flow immediately.
//   2. If the user is not authenticated (browser visit, no header token), redirect them to the home page
//      so they can sign in and then connect Klaviyo — instead of showing a raw JSON error.
router.get('/auth/klaviyo', (req: AuthRequest, res: express.Response) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    // If no userId was resolved by parseAuth, the user is not logged in.
    // Redirect to home with a flag so the frontend can prompt them to sign in.
    if (!req.userId) {
        return res.redirect(`${frontendUrl}/?connect_klaviyo=1`);
    }
    // User is authenticated — start the Klaviyo OAuth flow immediately.
    return startKlaviyoRedirect(req, res);
});

// POST with token in body (no token in URL). Frontend submits a form so the browser can follow the redirect.
router.post('/auth/klaviyo', (req: express.Request, res: express.Response) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const token = req.body?.token;
    if (typeof token !== 'string') {
        // Missing token — redirect to home page gracefully instead of raw JSON error
        return res.redirect(`${frontendUrl}/?connect_klaviyo=1`);
    }
    const payload = verifyToken(token);
    if (!payload) {
        // Invalid/expired session — redirect to home so user can sign in again
        return res.redirect(`${frontendUrl}/?error=session_expired&message=${encodeURIComponent('Your session has expired. Please sign in again.')}`);
    }
    (req as AuthRequest).userId = payload.userId;
    return startKlaviyoRedirect(req as AuthRequest, res);
});

// OAuth: Handle callback
router.get('/auth/callback/klaviyo', async (req, res) => {
    const { code, state, error, error_description } = req.query;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    if (error) {
        // Handle permission denied specifically
        if (error === 'access_denied') {
            const message = 'You denied the permissions required for Spam Profile Cleaner to work. ' +
                'To use this app, you need to grant access to read profiles and submit deletion requests. ' +
                'Please try connecting again if you want to use the app.';
            return res.redirect(`${frontendUrl}/?error=permission_denied&message=${encodeURIComponent(message)}`);
        }
        // Handle other OAuth errors
        const errorMsg = error_description || error;
        return res.redirect(`${frontendUrl}/?error=oauth_error&message=${encodeURIComponent(errorMsg as string)}`);
    }

    const codeVerifier = pkceStore.get(state as string);
    const userId = klaviyoStateToUserId.get(state as string);
    if (!codeVerifier) {
        return res.redirect(`${frontendUrl}/error?message=Invalid state`);
    }
    pkceStore.delete(state as string);
    klaviyoStateToUserId.delete(state as string);

    try {
        console.log('OAuth callback received, exchanging code for tokens...');
        const tokens = await exchangeCodeForTokens(code as string, codeVerifier);
        console.log('Tokens received successfully');

        const client = new KlaviyoClient(tokens.access_token);
        console.log('Fetching account info...');
        const accountInfo = await client.getAccountInfo();
        const klaviyoAccountId = accountInfo?.id || `account-${Date.now()}`;
        console.log('Account ID:', klaviyoAccountId);

        let account = await prisma.account.findUnique({
            where: { klaviyoAccountId },
        });

        const tokenData = {
            accessToken: encrypt(tokens.access_token),
            refreshToken: encrypt(tokens.refresh_token),
            tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            ...(userId ? { userId } : {}),
        };

        if (account) {
            const accountId = account.id;
            account = await withAccountContext(prisma, accountId, async () => {
                return await prisma.account.update({
                    where: { id: accountId },
                    data: tokenData,
                });
            });
        } else {
            account = await prisma.account.create({
                data: {
                    klaviyoAccountId,
                    ...tokenData,
                },
            });
        }

        console.log('Account stored with ID:', account.id);

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

        // Check if user has an existing subscription
        const existingSubscription = await prisma.subscription.findUnique({
            where: { accountId: account.id },
        });

        let redirectUrl: string;
        if (existingSubscription && existingSubscription.status === 'ACTIVE') {
            // User has active subscription - go to dashboard
            redirectUrl = `${frontendUrl}/dashboard?accountId=${account.id}`;
        } else {
            // No subscription - go to pricing page for tier selection
            // Pricing page will handle navigation based on tier selection from sessionStorage
            redirectUrl = `${frontendUrl}/pricing?accountId=${account.id}`;
        }

        // Use 302 temporary redirect to ensure browser follows it
        res.status(302).redirect(redirectUrl);
    } catch (err: any) {
        console.error('OAuth error:', err);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        res.redirect(`${frontendUrl}/error?message=${encodeURIComponent(err.message || 'Authentication failed')}`);
    }
});

// Get cleanup rules
router.get('/api/rules/:accountId', auth.requireAuth, auth.requireAccountOwnership, async (req, res) => {
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
router.post('/api/rules/:accountId', auth.requireAuth, auth.requireAccountOwnership, async (req, res) => {
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
router.delete('/api/rules/:ruleId', auth.requireAuth, async (req: AuthRequest, res) => {
    try {
        const ruleId = req.params.ruleId;

        const rule = await prisma.cleanupRule.findUnique({
            where: { id: ruleId },
            select: { accountId: true },
        });
        if (!rule) {
            return res.status(404).json({ error: 'Rule not found' });
        }

        const account = await prisma.account.findFirst({
            where: { id: rule.accountId, userId: req.userId! },
        });
        if (!account) {
            return res.status(403).json({ error: 'You do not have access to this rule.', code: 'FORBIDDEN' });
        }

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
router.get('/api/scan/:accountId/preview', auth.requireAuth, auth.requireAccountOwnership, async (req, res) => {
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
router.post('/api/scan/:accountId/execute', auth.requireAuth, auth.requireAccountOwnership, async (req, res) => {
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
router.get('/api/history/:accountId', auth.requireAuth, auth.requireAccountOwnership, async (req, res) => {
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
        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
        const expectedKey = process.env.CRON_API_KEY;

        if (!expectedKey) {
            console.error('CRON_API_KEY not set in environment variables');
            return res.status(500).json({ error: 'Server configuration error: CRON_API_KEY not set' });
        }

        if (!apiKey || apiKey !== expectedKey) {
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
router.get('/api/schedule/:accountId', auth.requireAuth, auth.requireAccountOwnership, async (req, res) => {
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
router.post('/api/schedule/:accountId', auth.requireAuth, auth.requireAccountOwnership, async (req, res) => {
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
router.post('/api/schedule/:accountId/run', auth.requireAuth, auth.requireAccountOwnership, async (req, res) => {
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
router.get('/api/schedule/:accountId/history', auth.requireAuth, auth.requireAccountOwnership, async (req, res) => {
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

// ==================== Account Disconnect/Uninstall Endpoints ====================

// Disconnect account - revokes OAuth token and cleans up data
// Called when user clicks "Disconnect" in the app
router.post('/api/disconnect/:accountId', auth.requireAuth, auth.requireAccountOwnership, async (req, res) => {
    try {
        const accountId = req.params.accountId;
        console.log(`Disconnect request for account: ${accountId}`);

        // Get account with tokens
        const account = await prisma.account.findUnique({
            where: { id: accountId },
        });

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        // Attempt to revoke OAuth token with Klaviyo
        let tokenRevoked = false;
        if (account.refreshToken) {
            try {
                const decryptedRefreshToken = decrypt(account.refreshToken);
                tokenRevoked = await revokeToken(decryptedRefreshToken);
            } catch (err: any) {
                console.error('Error decrypting/revoking token:', err.message);
                // Continue with cleanup even if revocation fails
            }
        }

        // Clean up account data using RLS context
        await withAccountContext(prisma, accountId, async () => {
            // Delete scheduled cleanup
            await prisma.scheduledCleanup.deleteMany({
                where: { accountId },
            });

            // Delete cleanup runs
            await prisma.cleanupRun.deleteMany({
                where: { accountId },
            });

            // Delete cleanup rules
            await prisma.cleanupRule.deleteMany({
                where: { accountId },
            });

            // Delete deletion logs
            await prisma.deletionLog.deleteMany({
                where: { accountId },
            });

            // Delete subscription (keep Stripe records, just unlink)
            await prisma.subscription.deleteMany({
                where: { accountId },
            });

            // Finally, delete the account
            await prisma.account.delete({
                where: { id: accountId },
            });
        });

        console.log(`Account ${accountId} disconnected successfully. Token revoked: ${tokenRevoked}`);

        res.json({
            success: true,
            message: 'Account disconnected successfully',
            tokenRevoked,
        });
    } catch (error: any) {
        console.error('Disconnect error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Webhook handler for Klaviyo uninstall events
// Klaviyo calls this when a user removes the integration from their Klaviyo account.
// URL must include the webhook secret: POST /webhooks/klaviyo/uninstall/:webhookSecret
// Set KLAVIYO_WEBHOOK_SECRET in env and configure Klaviyo to use that full URL.
router.post('/webhooks/klaviyo/uninstall/:webhookSecret?', async (req, res) => {
    try {
        const expectedSecret = process.env.KLAVIYO_WEBHOOK_SECRET;
        const providedSecret = req.params.webhookSecret;
        if (expectedSecret) {
            if (!providedSecret || providedSecret !== expectedSecret) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
        } else if (process.env.NODE_ENV === 'production') {
            console.warn('KLAVIYO_WEBHOOK_SECRET not set; rejecting uninstall webhook in production');
            return res.status(500).json({ error: 'Webhook not configured' });
        }

        const { data } = req.body || {};
        if (!data) {
            return res.status(200).json({ received: true });
        }

        // Extract account identifier from webhook
        // Klaviyo typically sends the account ID or integration ID
        const klaviyoAccountId = data.attributes?.account_id ||
            data.relationships?.account?.data?.id ||
            data.id;

        if (!klaviyoAccountId) {
            console.warn('Could not extract account ID from webhook payload');
            return res.status(200).json({ received: true });
        }

        console.log(`Processing uninstall for Klaviyo account: ${klaviyoAccountId}`);

        // Find account by Klaviyo account ID
        const account = await prisma.account.findUnique({
            where: { klaviyoAccountId },
        });

        if (!account) {
            console.log(`No account found for Klaviyo account ID: ${klaviyoAccountId}`);
            return res.status(200).json({ received: true, message: 'Account not found' });
        }

        // Clean up account data
        await withAccountContext(prisma, account.id, async () => {
            // Delete scheduled cleanup
            await prisma.scheduledCleanup.deleteMany({
                where: { accountId: account.id },
            });

            // Delete cleanup runs
            await prisma.cleanupRun.deleteMany({
                where: { accountId: account.id },
            });

            // Delete cleanup rules
            await prisma.cleanupRule.deleteMany({
                where: { accountId: account.id },
            });

            // Delete deletion logs
            await prisma.deletionLog.deleteMany({
                where: { accountId: account.id },
            });

            // Delete subscription
            await prisma.subscription.deleteMany({
                where: { accountId: account.id },
            });

            // Finally, delete the account
            await prisma.account.delete({
                where: { id: account.id },
            });
        });

        console.log(`Account ${account.id} removed via Klaviyo uninstall webhook`);

        res.status(200).json({
            received: true,
            success: true,
            message: 'Account removed successfully',
        });
    } catch (error: any) {
        console.error('Klaviyo uninstall webhook error:', error);
        // Always return 200 for webhooks to prevent retries
        res.status(200).json({
            received: true,
            error: error.message,
        });
    }
});

// OAuth permission denied handler
// Redirects users with clear messaging when they deny permissions
router.get('/auth/klaviyo/denied', (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const message = 'You denied the permissions required for Spam Profile Cleaner to work. ' +
        'To use this app, you need to grant access to read profiles and submit deletion requests. ' +
        'Please try connecting again if you want to use the app.';

    res.redirect(`${frontendUrl}/?error=permission_denied&message=${encodeURIComponent(message)}`);
});

export default router;

