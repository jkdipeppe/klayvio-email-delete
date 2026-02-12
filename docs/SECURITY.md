# Security Audit Summary

This document summarizes the security review of the Klaviyo Spam Profile Cleaner app (Google auth + Klaviyo OAuth, user-scoped data).

## Authentication & Authorization

### What was verified

- **Google OAuth**: State parameter is generated with `crypto.randomBytes(24)`, stored in memory, and validated on callback to prevent CSRF. One-time login codes are used so the JWT is never sent in the URL (see fixes below).
- **JWT**: Issued after Google login, contains `userId` and `email`. Verification uses `JWT_SECRET`; in production the app refuses to start if `JWT_SECRET` (or `APP_SECRET`) is missing or still the default.
- **Klaviyo OAuth**: PKCE with `code_verifier`/`code_challenge`; state is tied to `userId` in memory so the linked account is associated with the logged-in user.
- **Account ownership**: All account-scoped API routes use `auth.requireAccountOwnership`, which checks `Account.userId === req.userId` before any access. Users can only see and modify their own accounts and related data (rules, scan, schedule, subscription, disconnect).
- **Rule delete**: `DELETE /api/rules/:ruleId` does not take `accountId` in the path but loads the rule, then checks that the rule’s account belongs to `req.userId` before deleting.
- **Subscription checkout**: `accountId` in the body is validated with `findFirst({ where: { id: accountId, userId: req.userId } })` so users can only create checkouts for their own account.

### Data isolation

- All reads/writes for account-scoped data (rules, deletion logs, schedule, cleanup runs) go through `withAccountContext(prisma, accountId, ...)` so RLS/session context is set correctly.
- `POST /api/scan/:accountId/execute` accepts optional `profileIds` in the body; the server only deletes profiles that are in the **current account’s** scan result (`matches.filter(m => profileIds.includes(m.profileId))`), so users cannot delete arbitrary Klaviyo profiles from another account.

---

## Fixes applied

1. **JWT no longer in URL (Google callback)**  
   - **Risk**: Token in `?token=...` could appear in browser history, referrers, and logs.  
   - **Change**: Callback now redirects with a short-lived one-time `?code=...`. Frontend `POST /auth/exchange-token` with `{ code }` and receives `{ token }` in the response body; token is stored in memory/localStorage only.

2. **Klaviyo uninstall webhook**  
   - **Risk**: Unauthenticated `POST /webhooks/klaviyo/uninstall` could allow anyone to trigger account cleanup if they guessed or enumerated `klaviyoAccountId`.  
   - **Change**: Webhook URL now includes a secret path: `POST /webhooks/klaviyo/uninstall/:webhookSecret`. If `KLAVIYO_WEBHOOK_SECRET` is set, the path segment must match. In production, if the secret is not set, the webhook returns 500 so it is not left open.

3. **Debug endpoint**  
   - **Risk**: `GET /debug-env` exposed env info (e.g. DB URL prefix/length, port).  
   - **Change**: In production, `/debug-env` returns 404. Response no longer includes DB URL prefix or length.

4. **Cron endpoint logging**  
   - **Risk**: Logs included presence/length of API key and whether it matched.  
   - **Change**: Removed all logging of key presence, length, or match. Unauthorized requests still get 401 with no key details.

5. **Production secrets**  
   - **Risk**: Default fallbacks for `JWT_SECRET` and `APP_SECRET` could be used in production.  
   - **Change**: On startup in `NODE_ENV=production`, the server exits with a clear error if `JWT_SECRET` or `APP_SECRET` is missing or equals the default placeholder.

---

## Recommendations

- **Klaviyo webhook**: Klaviyo’s [OAuth app setup](https://developers.klaviyo.com/en/docs/set_up_oauth) only provides **Redirect URLs**; there is no Uninstall/Webhook URL field in the UI. You don’t need to set `KLAVIYO_WEBHOOK_SECRET` unless Klaviyo (or a partner program) gives you a URL to register. Uninstall is effectively handled when refresh returns `invalid_grant` (user is prompted to reconnect) and when the user clicks Disconnect in your app.
- **Cron**: Keep `CRON_API_KEY` strong and only in env; only your cron runner (e.g. Vercel Cron) should send it. The Next.js cron handler should verify Vercel’s cron header or a separate secret before calling the backend.
- **Secrets**: Use different values for `JWT_SECRET`, `APP_SECRET`, `KLAVIYO_WEBHOOK_SECRET`, and `CRON_API_KEY`; rotate if any might have been exposed.
- **State/PKCE stores**: Google state and Klaviyo PKCE/state are in-memory. For multiple backend instances, use a shared store (e.g. Redis) so state survives restarts and works across replicas.
- **Stripe webhook**: Already verified with `STRIPE_WEBHOOK_SECRET` and raw body; no change needed.

---

## Headers, body, and paths

- **Authorization**: APIs expect `Authorization: Bearer <JWT>`. The frontend sets this from localStorage via an axios interceptor; the token is never sent in query or path.
- **Klaviyo connect**: Token can be sent in request body for `POST /auth/klaviyo` (form submit for redirect); it is not put in the URL.
- **Account IDs**: `accountId` appears in path (e.g. `/api/rules/:accountId`). Ownership is enforced by `requireAccountOwnership`; path is not trusted without that check.
- **Body inputs**: `accountId` in subscription checkout and `profileIds` in scan execute are validated against the authenticated user and the current account’s data so users cannot act on other users’ resources.

---

## Summary

Authentication (Google + JWT) and Klaviyo linking (PKCE + state) are implemented with standard protections. All account-scoped operations enforce ownership; RLS/context is used for account-scoped DB access. The main issues addressed were token-in-URL, unauthenticated Klaviyo webhook, debug endpoint exposure, cron key logging, and production use of default secrets. With the changes above and the recommended env/config (webhook secret, cron key, strong JWT/APP secrets), the flow is in good shape for production from an auth and data-isolation perspective.
