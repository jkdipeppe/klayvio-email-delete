# Production readiness checklist

Use this before deploying to production. References: [Klaviyo Set up OAuth](https://developers.klaviyo.com/en/docs/set_up_oauth), [Create a public OAuth app](https://developers.klaviyo.com/en/docs/create_a_public_oauth_app), and `docs/SECURITY.md`.

---

## 1. Environment variables (backend)

| Variable | Required | Notes |
|----------|----------|--------|
| `NODE_ENV` | Yes | Set to `production`. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `JWT_SECRET` | Yes | Strong random value (e.g. `openssl rand -hex 32`). App exits on startup if missing or default in prod. |
| `APP_SECRET` | Yes | Strong random value for encrypting Klaviyo tokens. Same startup check as above. |
| `FRONTEND_URL` | Yes | Full origin of the frontend (e.g. `https://app.example.com`). Used for CORS and OAuth redirects. |
| `GOOGLE_CLIENT_ID` | Yes | From Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | Yes | |
| `GOOGLE_REDIRECT_URI` | Yes | Must exactly match the redirect URI configured in Google (e.g. `https://api.example.com/auth/callback/google`). |
| `KLAVIYO_CLIENT_ID` | Yes | From Klaviyo Manage apps. |
| `KLAVIYO_CLIENT_SECRET` | Yes | |
| `KLAVIYO_REDIRECT_URI` | Yes | Must **exactly** match a Redirect URL allowlisted in Klaviyo (e.g. `https://api.example.com/auth/callback/klaviyo`). |
| `CRON_API_KEY` | Yes | If you use scheduled cleanup. Strong random value; only your cron job should send it. |
| `STRIPE_SECRET_KEY` | If using billing | |
| `STRIPE_WEBHOOK_SECRET` | If using billing | For Stripe webhook signature verification. |
| `STRIPE_BASIC_PRICE_ID` / `STRIPE_PRO_PRICE_ID` | If using billing | |
| `KLAVIYO_WEBHOOK_SECRET` | No | Only if Klaviyo (or a partner program) gives you an uninstall webhook URL to register. Otherwise leave unset. |

---

## 2. Klaviyo app configuration

In [Manage apps](https://www.klaviyo.com/manage-apps) → your app → **Edit**:

- **Redirect URLs**  
  Add your production callback URL **exactly** as used in `KLAVIYO_REDIRECT_URI` (e.g. `https://api.example.com/auth/callback/klaviyo`). No trailing slash mismatch.

- **Scopes**  
  Set the same scopes we request (least permissive per [app listing requirements](https://developers.klaviyo.com/en/docs/create_a_public_oauth_app)):  
  `accounts:read profiles:read data-privacy:read data-privacy:write`  
  Do not add extra scopes (e.g. no `lists:write`, `campaigns:write`, `metrics:read` unless you need them).

- **Token traffic**  
  Our code already uses `https://a.klaviyo.com/oauth/token` and `https://a.klaviyo.com/oauth/revoke` (required since March 2025; `www.klaviyo.com` is blocked for token/revoke). No change needed.

---

## 3. Google OAuth configuration

In Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client:

- **Authorized redirect URIs**  
  Add your production callback **exactly** as in `GOOGLE_REDIRECT_URI` (e.g. `https://api.example.com/auth/callback/google`).

---

## 4. CORS and HTTPS

- **CORS**  
  Backend uses `origin: process.env.FRONTEND_URL`. Ensure `FRONTEND_URL` is the exact frontend origin (e.g. `https://app.example.com`). No trailing slash.

- **HTTPS**  
  Use HTTPS for frontend and backend in production. OAuth redirects and cookies/tokens should not be sent over plain HTTP.

---

## 5. Security (already implemented)

- [ ] **Debug endpoint** – `GET /debug-env` returns 404 in production.
- [ ] **JWT / APP_SECRET** – App exits in production if these are missing or default.
- [ ] **Token not in URL** – Google callback uses one-time code; frontend exchanges for JWT via POST.
- [ ] **Account ownership** – All account-scoped APIs use `requireAccountOwnership`.
- [ ] **Cron** – `/api/schedule/run` requires `CRON_API_KEY` (header `X-API-Key` or `Authorization: Bearer <key>`).
- [ ] **Stripe webhook** – Signature verified with `STRIPE_WEBHOOK_SECRET`.
- [ ] **invalid_grant** – Refresh token 400 with `invalid_grant` is treated as “reconnect required” per Klaviyo docs.

---

## 6. Frontend (production)

- **Backend URL**  
  Set `BACKEND_URL` (or equivalent) so the frontend rewrites `/api/*` and `/auth/*` to your production backend (e.g. `https://api.example.com`).

- **No secrets in client**  
  JWT is stored in localStorage and sent in `Authorization` header; no API keys or secrets in frontend code or env.

---

## 7. Optional / operational

- **Rate limits**  
  Klaviyo refresh token: max 10 requests per minute. We reuse access tokens until they expire; ensure you don’t refresh on every request.

- **Multi-instance**  
  Google state and Klaviyo PKCE/state are in-memory. For multiple backend instances, use a shared store (e.g. Redis) keyed by state so OAuth flows work across instances.

- **Logging**  
  Avoid logging full tokens, secrets, or PII. We no longer log cron key presence/length.

---

## Summary

1. Set all required env vars; ensure `JWT_SECRET` and `APP_SECRET` are strong and not default.  
2. In Klaviyo: Redirect URL and scopes match our usage; token/revoke already use `a.klaviyo.com`.  
3. In Google: Redirect URI matches `GOOGLE_REDIRECT_URI`.  
4. Use HTTPS and correct `FRONTEND_URL` / CORS.  
5. Rely on `docs/SECURITY.md` for auth and data-isolation details.

After this, the app is ready for production from a security and OAuth perspective.
