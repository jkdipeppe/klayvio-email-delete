import { Router } from 'express';
import { PrismaClient, SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';
import { withAccountContext } from '../utils/rls';
import { getSubscriptionInfo } from '../utils/subscription-limits';

const router = Router();
// Configure Prisma to disable prepared statements for connection pooling compatibility
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL?.includes('pgbouncer=true')
                ? process.env.DATABASE_URL
                : process.env.DATABASE_URL?.replace(/(\?|$)/, (match, p1) => p1 ? `${p1}&pgbouncer=true` : '?pgbouncer=true'),
        },
    },
});

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
    })
    : null;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// Get subscription status
router.get('/api/subscription/:accountId', async (req, res) => {
    try {
        const accountId = req.params.accountId;

        const account = await prisma.account.findUnique({
            where: { id: accountId },
            include: {
                subscription: true,
                rules: true,
            },
        });

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        // Use getSubscriptionInfo to get consistent limits including maxProfilesPerDeletion
        const subscriptionInfo = await getSubscriptionInfo(prisma, accountId);

        res.json({
            tier: subscriptionInfo.tier,
            status: subscriptionInfo.status,
            limits: subscriptionInfo.limits,
            currentRuleCount: subscriptionInfo.currentRuleCount,
            canCreateMoreRules: subscriptionInfo.canCreateMoreRules,
            canSchedule: subscriptionInfo.canSchedule,
            maxProfilesPerDeletion: subscriptionInfo.maxProfilesPerDeletion,
            subscription: subscriptionInfo.subscription ? {
                id: subscriptionInfo.subscription.id,
                tier: subscriptionInfo.subscription.tier,
                status: subscriptionInfo.subscription.status,
                currentPeriodStart: subscriptionInfo.subscription.currentPeriodStart,
                currentPeriodEnd: subscriptionInfo.subscription.currentPeriodEnd,
                cancelAtPeriodEnd: subscriptionInfo.subscription.cancelAtPeriodEnd,
            } : null,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Create Stripe checkout session
router.post('/api/subscription/checkout', async (req, res) => {
    try {
        if (!stripe) {
            return res.status(500).json({ error: 'Stripe not configured. Please set STRIPE_SECRET_KEY.' });
        }

        const { accountId, tier } = req.body;

        if (!accountId || !tier) {
            return res.status(400).json({ error: 'accountId and tier are required' });
        }

        if (tier !== 'BASIC' && tier !== 'PRO') {
            return res.status(400).json({ error: 'tier must be BASIC or PRO' });
        }

        // Verify account exists
        const account = await prisma.account.findUnique({
            where: { id: accountId },
        });

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        // Get Stripe price ID from environment
        const priceId = tier === 'BASIC'
            ? process.env.STRIPE_BASIC_PRICE_ID
            : process.env.STRIPE_PRO_PRICE_ID;

        if (!priceId) {
            return res.status(500).json({ error: 'Stripe price ID not configured' });
        }

        // Create or get Stripe customer
        let customerId: string;
        const existingSubscription = await prisma.subscription.findUnique({
            where: { accountId },
        });

        if (existingSubscription?.stripeCustomerId) {
            customerId = existingSubscription.stripeCustomerId;
        } else {
            // Create new Stripe customer
            const customer = await stripe.customers.create({
                metadata: {
                    accountId,
                },
            });
            customerId = customer.id;
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${FRONTEND_URL}/dashboard?accountId=${accountId}&subscription=success`,
            cancel_url: `${FRONTEND_URL}/pricing?accountId=${accountId}&subscription=canceled`,
            metadata: {
                accountId,
                tier,
            },
        });

        res.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Stripe webhook handler
router.post('/api/subscription/webhook', async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event: Stripe.Event;

    try {
        // req.body is already raw buffer from express.raw() middleware
        event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const accountId = session.metadata?.accountId;
                const tier = session.metadata?.tier as SubscriptionTier;

                if (!accountId || !tier) {
                    console.error('Missing accountId or tier in session metadata');
                    break;
                }

                // Get subscription from Stripe
                const subscriptionId = session.subscription as string;
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                // Create or update subscription in database
                await withAccountContext(prisma, accountId, async () => {
                    await prisma.subscription.upsert({
                        where: { accountId },
                        create: {
                            accountId,
                            tier,
                            status: SubscriptionStatus.ACTIVE,
                            stripeCustomerId: session.customer as string,
                            stripeSubscriptionId: subscriptionId,
                            stripePriceId: subscription.items.data[0].price.id,
                            currentPeriodStart: new Date(subscription.current_period_start * 1000),
                            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                        },
                        update: {
                            tier,
                            status: SubscriptionStatus.ACTIVE,
                            stripeCustomerId: session.customer as string,
                            stripeSubscriptionId: subscriptionId,
                            stripePriceId: subscription.items.data[0].price.id,
                            currentPeriodStart: new Date(subscription.current_period_start * 1000),
                            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                            cancelAtPeriodEnd: false,
                        },
                    });
                });

                console.log(`Subscription created/updated for account ${accountId}`);
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                // Find account by customer ID
                const dbSubscription = await prisma.subscription.findUnique({
                    where: { stripeCustomerId: customerId },
                });

                if (!dbSubscription) {
                    console.error(`Subscription not found for customer ${customerId}`);
                    break;
                }

                // Update subscription status
                let status: SubscriptionStatus = SubscriptionStatus.ACTIVE;
                if (subscription.status === 'canceled') {
                    status = SubscriptionStatus.CANCELED;
                } else if (subscription.status === 'past_due') {
                    status = SubscriptionStatus.PAST_DUE;
                } else if (subscription.status === 'unpaid') {
                    status = SubscriptionStatus.UNPAID;
                }

                await withAccountContext(prisma, dbSubscription.accountId, async () => {
                    await prisma.subscription.update({
                        where: { accountId: dbSubscription.accountId },
                        data: {
                            status,
                            currentPeriodStart: new Date(subscription.current_period_start * 1000),
                            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                            cancelAtPeriodEnd: subscription.cancel_at_period_end,
                        },
                    });
                });

                console.log(`Subscription updated for account ${dbSubscription.accountId}`);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                const dbSubscription = await prisma.subscription.findUnique({
                    where: { stripeCustomerId: customerId },
                });

                if (dbSubscription) {
                    await withAccountContext(prisma, dbSubscription.accountId, async () => {
                        await prisma.subscription.update({
                            where: { accountId: dbSubscription.accountId },
                            data: {
                                status: SubscriptionStatus.CANCELED,
                            },
                        });
                    });
                }

                console.log(`Subscription canceled for customer ${customerId}`);
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error: any) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cancel subscription
router.post('/api/subscription/:accountId/cancel', async (req, res) => {
    try {
        if (!stripe) {
            return res.status(500).json({ error: 'Stripe not configured' });
        }

        const accountId = req.params.accountId;

        const subscription = await prisma.subscription.findUnique({
            where: { accountId },
        });

        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        if (!subscription.stripeSubscriptionId) {
            return res.status(400).json({ error: 'No Stripe subscription found' });
        }

        // Cancel at period end in Stripe
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
        });

        // Update in database
        await withAccountContext(prisma, accountId, async () => {
            await prisma.subscription.update({
                where: { accountId },
                data: {
                    cancelAtPeriodEnd: true,
                },
            });
        });

        res.json({ message: 'Subscription will be canceled at the end of the billing period' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Change subscription tier (upgrade/downgrade)
router.post('/api/subscription/:accountId/change-tier', async (req, res) => {
    try {
        if (!stripe) {
            return res.status(500).json({ error: 'Stripe not configured' });
        }

        const accountId = req.params.accountId;
        const { newTier } = req.body;

        if (!newTier || (newTier !== 'BASIC' && newTier !== 'PRO')) {
            return res.status(400).json({ error: 'newTier must be BASIC or PRO' });
        }

        const subscription = await prisma.subscription.findUnique({
            where: { accountId },
        });

        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        if (!subscription.stripeSubscriptionId) {
            return res.status(400).json({ error: 'No Stripe subscription found' });
        }

        // Get the new price ID
        const newPriceId = newTier === 'BASIC'
            ? process.env.STRIPE_BASIC_PRICE_ID
            : process.env.STRIPE_PRO_PRICE_ID;

        if (!newPriceId) {
            return res.status(500).json({ error: 'Stripe price ID not configured' });
        }

        // If already on this tier, return success
        if (subscription.tier === newTier) {
            return res.json({ message: 'Already on this tier', subscription });
        }

        // Update subscription in Stripe
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);

        // Update subscription item to new price
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            items: [{
                id: stripeSubscription.items.data[0].id,
                price: newPriceId,
            }],
            proration_behavior: 'always_invoice', // Prorate the difference
        });

        // Update in database
        await withAccountContext(prisma, accountId, async () => {
            await prisma.subscription.update({
                where: { accountId },
                data: {
                    tier: newTier as SubscriptionTier,
                    stripePriceId: newPriceId,
                    cancelAtPeriodEnd: false, // Remove cancellation if upgrading
                },
            });
        });

        res.json({
            message: `Subscription changed to ${newTier} plan`,
            tier: newTier,
        });
    } catch (error: any) {
        console.error('Change tier error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Reactivate canceled subscription
router.post('/api/subscription/:accountId/reactivate', async (req, res) => {
    try {
        if (!stripe) {
            return res.status(500).json({ error: 'Stripe not configured' });
        }

        const accountId = req.params.accountId;

        const subscription = await prisma.subscription.findUnique({
            where: { accountId },
        });

        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        if (!subscription.stripeSubscriptionId) {
            return res.status(400).json({ error: 'No Stripe subscription found' });
        }

        // Remove cancellation in Stripe
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: false,
        });

        // Update in database
        await withAccountContext(prisma, accountId, async () => {
            await prisma.subscription.update({
                where: { accountId },
                data: {
                    cancelAtPeriodEnd: false,
                    status: SubscriptionStatus.ACTIVE,
                },
            });
        });

        res.json({ message: 'Subscription reactivated' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

