# Token Refresh & Scheduled Cleanup - How It Works

## The Problem

**Klaviyo OAuth tokens expire** (typically after a few hours to days). Without automatic refresh:
- ❌ Scheduled cleanup will fail when tokens expire
- ❌ Users would need to re-authenticate frequently
- ❌ Poor user experience

## The Solution

We've implemented **automatic token refresh** that:

1. ✅ **Checks token expiration** before every API call
2. ✅ **Automatically refreshes** expired or soon-to-expire tokens
3. ✅ **Stores new tokens** securely in the database
4. ✅ **Works seamlessly** - users never need to re-authenticate

## How It Works

### Token Refresh Flow

```
┌─────────────────────────────────────┐
│ Scheduled Cleanup Runs               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Get Account from Database            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Check: Is token expired?            │
│ (or expires in < 5 minutes)         │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
     YES│             │NO
        │             │
        ▼             ▼
┌──────────────┐  ┌──────────────┐
│ Refresh      │  │ Use existing│
│ Token        │  │ token       │
└──────┬───────┘  └──────┬──────┘
       │                  │
       └────────┬─────────┘
                │
                ▼
┌─────────────────────────────────────┐
│ Call Klaviyo API                    │
│ (Delete profiles)                   │
└─────────────────────────────────────┘
```

### Implementation Details

**1. Token Manager Utility** (`utils/token-manager.ts`)
- `getValidAccessToken()` - Gets valid token, refreshes if needed
- `isTokenValid()` - Checks if token is still valid
- Handles all refresh logic automatically

**2. Automatic Refresh**
- Checks expiration before every API call
- Refreshes tokens that expire in < 5 minutes (buffer)
- Uses stored `refreshToken` to get new `accessToken`
- Updates database with new tokens

**3. Error Handling**
- If refresh fails, throws clear error
- Scheduled job can log and skip that account
- User can re-authenticate if needed

## Scheduled Cleanup Flow

When Railway cron runs:

```typescript
1. Find accounts due for cleanup
2. For each account:
   a. Get valid access token (auto-refreshes if needed)
   b. Create KlaviyoClient with fresh token
   c. Scan profiles
   d. Delete matching profiles
   e. Update schedule (lastRunAt, nextRunAt)
3. Continue to next account
```

## Token Expiration Details

### Klaviyo Token Lifespan

- **Access Token**: Typically expires in 1-24 hours
- **Refresh Token**: Typically valid for 30-90 days (or until revoked)
- **Our Buffer**: Refresh 5 minutes before expiration

### What Happens When Refresh Token Expires?

If the refresh token itself expires:
- ❌ Token refresh will fail
- ✅ Scheduled cleanup will skip that account
- ✅ Log error for monitoring
- ✅ User needs to re-authenticate (one-time)

**This is rare** - refresh tokens last 30-90 days, so users only need to re-authenticate every few months.

## User Experience

### For Users

✅ **One-time setup**: Connect Klaviyo account once
✅ **Automatic cleanup**: Runs on schedule without user action
✅ **No re-authentication**: Tokens refresh automatically
✅ **Set and forget**: Configure schedule, it just works

### Edge Cases Handled

1. **Token expires during cleanup**
   - Token refreshes automatically before API calls
   - No interruption to cleanup process

2. **Multiple cleanups running**
   - Each uses its own token refresh
   - No conflicts

3. **Refresh token expired**
   - Cleanup skips that account
   - Logs error for monitoring
   - User can re-authenticate when ready

## Security

- ✅ Tokens stored encrypted in database
- ✅ Refresh tokens never exposed to frontend
- ✅ Automatic refresh happens server-side only
- ✅ RLS ensures users can only refresh their own tokens

## Monitoring

### What to Monitor

1. **Token refresh success rate**
   - Should be > 99%
   - Log failures for investigation

2. **Refresh token expiration**
   - Track accounts needing re-authentication
   - Notify users proactively (future feature)

3. **Scheduled cleanup success**
   - Track accounts processed successfully
   - Track accounts skipped due to token issues

## Testing

### Manual Test

1. Create account and authenticate
2. Wait for token to expire (or manually expire in DB)
3. Trigger scheduled cleanup
4. Verify token refreshes automatically
5. Verify cleanup completes successfully

### Automated Test

```typescript
// Test token refresh
const expiredAccount = await createExpiredTokenAccount();
const token = await getValidAccessToken(prisma, expiredAccount.id);
expect(token).toBeDefined();
expect(token).not.toBe(expiredAccount.accessToken);
```

## Summary

✅ **Yes, it will work automatically!**

- Users authenticate once
- Tokens refresh automatically
- Scheduled cleanup runs without user intervention
- Works reliably for months at a time
- Only requires re-authentication if refresh token expires (rare)

The implementation ensures scheduled cleanup is **fully automated** and **reliable**.

