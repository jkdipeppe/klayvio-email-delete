# Fixing Google OAuth `redirect_uri_mismatch` (Error 400)

**Error 400: redirect_uri_mismatch** means the `redirect_uri` your app sends to Google does not **exactly** match any **Authorized redirect URI** in your Google Cloud OAuth client.

---

## 1. Decide which URL Google should redirect to

After the user signs in with Google, their **browser** is sent to your redirect URI. That URL must be the one that reaches your **backend** callback (`/auth/callback/google`).

- **If you use the frontend proxy (Next.js rewrites `/auth/*` to backend):**  
  The browser URL bar will show your **frontend** host. So the redirect URI is:
  ```text
  https://YOUR_FRONTEND_DOMAIN/auth/callback/google
  ```
  Example: `https://yourapp.vercel.app/auth/callback/google` or `https://app.yourapp.com/auth/callback/google`.

- **If users hit the backend directly for auth:**  
  Use your **backend** host:
  ```text
  https://YOUR_BACKEND_DOMAIN/auth/callback/google
  ```
  Example: `https://api.yourapp.com/auth/callback/google`.

Use **one** of these. The same URL must be used in both your app and Google Console.

---

## 2. Set it in your backend `.env` (production)

Set **exactly** that URL (no trailing slash, correct protocol and path):

```bash
GOOGLE_REDIRECT_URI=https://YOUR_DOMAIN/auth/callback/google
```

Examples:

- Frontend domain: `GOOGLE_REDIRECT_URI=https://yourapp.vercel.app/auth/callback/google`
- Backend domain: `GOOGLE_REDIRECT_URI=https://api.yourapp.com/auth/callback/google`

---

## 3. Add the same URL in Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Click your **OAuth 2.0 Client ID** (Web application).
3. Under **Authorized redirect URIs**, click **Add URI**.
4. Paste the **exact** same URL you set in `GOOGLE_REDIRECT_URI` (character-for-character).
5. Save.

Google does not allow partial or fuzzy matches. The redirect URI is case-sensitive and must match exactly (including `https`, no trailing slash unless you use it everywhere, and the path `/auth/callback/google`).

---

## 4. Typical mistakes

| Mistake | Fix |
|--------|-----|
| **http vs https** | Production must use `https://`. Add the `https://` URI in Google Console. |
| **Trailing slash** | Either use no trailing slash everywhere: `.../auth/callback/google`, or the same trailing slash in both .env and Google. |
| **Wrong host** | If the browser lands on the frontend (e.g. Vercel), use the **frontend** domain in both .env and Google. If it lands on the backend, use the **backend** domain. |
| **Port in URL** | Only include a port if the user actually sees it (e.g. `http://localhost:3000/...`). Production usually has no port. |
| **Only localhost in Google** | Add the **production** redirect URI in Google; localhost alone is not enough for prod. |

---

## 5. Quick check

- **Backend:** The value of `GOOGLE_REDIRECT_URI` in production is the full URL where the user is sent after Google login.
- **Google Console:** That **exact** string is listed under **Authorized redirect URIs**.
- After changing either, try “Sign in with Google” again (and clear cache/cookies if needed).
