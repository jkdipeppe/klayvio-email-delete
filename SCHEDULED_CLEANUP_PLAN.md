# Scheduled Cleanup Feature - Implementation Plan

## Overview

Allow users to configure automatic cleanup that runs on a schedule (e.g., every X days) to automatically delete spam profiles based on their rules.

## Requirements

1. Users can enable/disable scheduled cleanup
2. Users can set frequency (every X days)
3. System tracks last run time
4. System respects Klaviyo rate limits
5. System handles failures gracefully
6. Users receive notifications (optional)

---

## Architecture Options

### Option 1: Railway Cron + API Endpoint (Recommended for Simplicity)

**How it works:**
- Railway cron job runs every hour/day
- Calls an API endpoint that checks for accounts needing cleanup
- Endpoint processes all accounts due for cleanup

**Pros:**
- Simple to implement
- No additional infrastructure
- Railway handles scheduling
- Free tier available

**Cons:**
- Less flexible (fixed schedule)
- All accounts processed in one job (could be slow)

**Best for:** Small to medium scale

---

### Option 2: Bull Queue + Redis (Recommended for Scale)

**How it works:**
- Redis-backed job queue (Bull)
- Each account gets its own scheduled job
- Jobs run independently based on account schedule

**Pros:**
- Highly scalable
- Individual account scheduling
- Better error handling
- Can retry failed jobs
- More flexible

**Cons:**
- Requires Redis (additional service)
- More complex setup
- Higher cost

**Best for:** Production at scale

---

### Option 3: Vercel Cron + API Route

**How it works:**
- Vercel Cron triggers Next.js API route
- API route calls backend to process accounts

**Pros:**
- Works with existing Vercel deployment
- Simple setup
- Free tier available

**Cons:**
- Less flexible than Railway
- Requires backend to be accessible from Vercel
- Limited to Vercel's cron schedule

**Best for:** If frontend is on Vercel

---

### Option 4: External Cron Service

**How it works:**
- Use services like cron-job.org, EasyCron, etc.
- They call your API endpoint on schedule

**Pros:**
- No infrastructure changes
- Very simple

**Cons:**
- External dependency
- Less control
- Potential reliability issues

**Best for:** Quick MVP

---

## Recommended Approach: Hybrid (Railway Cron + Job Queue)

**Phase 1: Railway Cron (MVP)**
- Start with Railway cron for simplicity
- Single endpoint processes all accounts
- Good enough for initial launch

**Phase 2: Add Bull Queue (Scale)**
- Migrate to Bull + Redis when needed
- Better for handling many accounts
- More robust error handling

---

## Database Schema Changes

### Add ScheduledCleanup Table

```prisma
model ScheduledCleanup {
  id            String   @id @default(uuid())
  accountId     String   @unique
  account       Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  isEnabled     Boolean  @default(false)
  frequencyDays Int      @default(7) // Run every X days
  lastRunAt     DateTime?
  nextRunAt     DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([nextRunAt, isEnabled]) // For efficient querying
}
```

### Add RunHistory Table (Optional)

```prisma
model CleanupRun {
  id            String   @id @default(uuid())
  accountId     String
  account       Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  startedAt     DateTime @default(now())
  completedAt   DateTime?
  status        RunStatus
  profilesFound Int      @default(0)
  profilesDeleted Int    @default(0)
  profilesFailed Int     @default(0)
  errorMessage  String?
  
  @@index([accountId, startedAt])
}

enum RunStatus {
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

---

## Implementation Plan

### Step 1: Database Schema

1. Add `ScheduledCleanup` model to Prisma schema
2. Add `CleanupRun` model (optional, for history)
3. Run migration
4. Update RLS policies

### Step 2: API Endpoints

**User-facing endpoints:**
- `GET /api/schedule/:accountId` - Get schedule config
- `POST /api/schedule/:accountId` - Create/update schedule
- `DELETE /api/schedule/:accountId` - Disable schedule
- `GET /api/schedule/:accountId/history` - Get run history

**System endpoint (called by cron):**
- `POST /api/schedule/run` - Process all due accounts (protected by API key)

### Step 3: Scheduled Job Logic

**Railway Cron Approach:**
```typescript
// Endpoint: POST /api/schedule/run
// Called by Railway cron every hour

1. Query all accounts where:
   - isEnabled = true
   - nextRunAt <= now()
   - OR nextRunAt is null (first run)

2. For each account:
   - Fetch account and rules
   - Run profile scanner
   - Delete matching profiles
   - Update lastRunAt and nextRunAt
   - Create CleanupRun record
   - Handle errors gracefully

3. Return summary
```

### Step 4: Frontend UI

**Dashboard additions:**
- Toggle to enable/disable scheduled cleanup
- Input for frequency (days)
- Display last run time
- Show next scheduled run
- Link to run history

### Step 5: Railway Cron Configuration

**railway.json:**
```json
{
  "cron": [
    {
      "schedule": "0 * * * *", // Every hour
      "command": "curl -X POST https://your-api.railway.app/api/schedule/run -H 'Authorization: Bearer YOUR_API_KEY'"
    }
  ]
}
```

**Or use Railway's UI:**
- Go to project → Cron Jobs
- Add new cron job
- Set schedule (e.g., every hour)
- Set command to call your endpoint

---

## Security Considerations

### Protect Cron Endpoint

```typescript
// Middleware to protect /api/schedule/run
const CRON_API_KEY = process.env.CRON_API_KEY;

router.post('/api/schedule/run', async (req, res) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
  
  if (apiKey !== `Bearer ${CRON_API_KEY}` && apiKey !== CRON_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Process accounts...
});
```

### Rate Limiting

- Process accounts sequentially (not parallel)
- Respect Klaviyo rate limits (60 deletions/minute)
- Add delays between accounts if needed

---

## Error Handling

### Per-Account Errors

- If one account fails, continue with others
- Log errors to CleanupRun table
- Don't update nextRunAt if failed (retry next cycle)

### Rate Limit Errors

- If rate limited, pause and retry later
- Track rate limit status
- Exponential backoff

---

## Monitoring & Logging

### Metrics to Track

- Number of accounts processed
- Total profiles deleted
- Average processing time
- Error rate
- Rate limit hits

### Logging

- Log each run start/end
- Log errors with context
- Log rate limit warnings

---

## Migration Path

### Phase 1: MVP (Railway Cron)
- Simple endpoint processes all accounts
- Basic error handling
- Good enough for initial users

### Phase 2: Scale (Bull Queue)
- Migrate to Bull + Redis
- Individual job scheduling
- Better error handling
- Retry logic

---

## Cost Considerations

### Railway Cron
- Included in Railway plan
- No additional cost

### Bull + Redis
- Redis: ~$5-10/month (Upstash, Railway Redis)
- More infrastructure to manage

### Recommendation
- Start with Railway Cron
- Migrate to Bull when you have 100+ active schedules

---

## Testing Strategy

### Unit Tests
- Test schedule calculation logic
- Test nextRunAt calculation
- Test error handling

### Integration Tests
- Test full cleanup flow
- Test with mock Klaviyo API
- Test rate limiting

### Manual Testing
- Create test account
- Set schedule
- Wait for cron to run
- Verify cleanup happened

---

## User Experience

### Dashboard UI

```
┌─────────────────────────────────────┐
│ Scheduled Cleanup                    │
├─────────────────────────────────────┤
│ ☑ Enable automatic cleanup          │
│                                     │
│ Run every [7] days                  │
│                                     │
│ Last run: 2 days ago                │
│ Next run: in 5 days                 │
│                                     │
│ [View History] [Run Now]            │
└─────────────────────────────────────┘
```

### Notifications (Future)

- Email when cleanup completes
- Email if cleanup fails
- Summary of deleted profiles

---

## Implementation Checklist

### Backend
- [ ] Add ScheduledCleanup model to schema
- [ ] Add CleanupRun model (optional)
- [ ] Create migration
- [ ] Update RLS policies
- [ ] Create schedule API endpoints
- [ ] Create cron endpoint
- [ ] Add API key protection
- [ ] Implement cleanup logic
- [ ] Add error handling
- [ ] Add logging

### Frontend
- [ ] Add schedule UI component
- [ ] Add enable/disable toggle
- [ ] Add frequency input
- [ ] Display last/next run times
- [ ] Add run history view
- [ ] Add "Run Now" button

### Infrastructure
- [ ] Set up Railway cron job
- [ ] Configure API key
- [ ] Test cron execution
- [ ] Set up monitoring

---

## Questions to Consider

1. **Should users be able to set custom schedules?**
   - Yes: More flexible, more complex
   - No: Simpler, less flexible
   - Recommendation: Start with fixed intervals (every X days)

2. **What happens if cleanup takes longer than cron interval?**
   - Skip next run if still running
   - Queue for next cycle
   - Recommendation: Skip if still running

3. **Should we notify users?**
   - Yes: Better UX, more complexity
   - No: Simpler
   - Recommendation: Start without, add later

4. **What's the minimum frequency?**
   - Daily? Weekly?
   - Recommendation: Minimum 1 day (respect rate limits)

---

## Next Steps

1. Review and approve this plan
2. Implement database schema
3. Implement backend endpoints
4. Implement frontend UI
5. Set up Railway cron
6. Test end-to-end
7. Deploy

