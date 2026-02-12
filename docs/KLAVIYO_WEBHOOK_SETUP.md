# Klaviyo “uninstall” and webhook URL

## Klaviyo only has Redirect URLs (no uninstall webhook URL)

In [Klaviyo’s OAuth setup](https://developers.klaviyo.com/en/docs/set_up_oauth) and **Manage apps** → your app → **Edit**, you only get **Redirect URLs**. There is **no** Webhook URL, Callback URL, or Uninstall URL field. You don’t configure an uninstall endpoint anywhere in Klaviyo’s UI.

So you **do not** need to set `KLAVIYO_WEBHOOK_SECRET` or paste any URL into Klaviyo for uninstall. Our uninstall webhook endpoint exists for the future (e.g. if Klaviyo adds such a callback for apps) or for partner-specific setups; for standard OAuth apps there’s nowhere to put that URL.

## How “uninstall” is actually handled

When a user removes your app from Klaviyo’s side (or the refresh token is revoked for other reasons), Klaviyo does **not** call a URL on your backend. Instead:

1. **Refresh token becomes invalid**  
   The next time your app tries to refresh the access token (e.g. before a scan or scheduled run), Klaviyo returns `400` with `{"error":"invalid_grant"}`. Per [Klaviyo’s OAuth docs](https://developers.klaviyo.com/en/docs/set_up_oauth), you can treat that as “the app was uninstalled (or token revoked).”

2. **Your app’s behavior**  
   When that happens, `getValidAccessToken` in `token-manager.ts` fails and throws `AuthenticationRequiredError`. The user sees that their Klaviyo connection has expired and is prompted to **reconnect**. Your backend does not automatically delete the account record; the user can reconnect the same Klaviyo account if they reinstall.

3. **In-app Disconnect**  
   When the user clicks **Disconnect** inside your app, your backend calls `POST /api/disconnect/:accountId`, which revokes the token with Klaviyo (`/oauth/revoke`) and deletes the account and related data. That’s the only place where you proactively clean up on “uninstall” from your side.

So in practice:

- **Redirect URLs** in Klaviyo = the only URLs you configure there (for OAuth callback).
- **Uninstall** = detected indirectly via `invalid_grant` when refreshing, or done explicitly by the user via **Disconnect** in your app.

## Optional: `KLAVIYO_WEBHOOK_SECRET` and the uninstall webhook

We have an endpoint:

```text
POST https://YOUR_BACKEND_HOST/webhooks/klaviyo/uninstall/<secret>
```

- If **KLAVIYO_WEBHOOK_SECRET** is set in backend `.env`, the path segment must match that secret or the request is rejected.
- In production, if the secret is **not** set, the endpoint returns 500 so it’s not left open.

You only need this if Klaviyo (or a partner program) gives you a way to register such a URL. With the current [OAuth app setup](https://developers.klaviyo.com/en/docs/set_up_oauth), there is no such field, so you can leave `KLAVIYO_WEBHOOK_SECRET` unset and ignore this endpoint until/unless that changes.
