# Risk Assessment & Compliance

## Meta API Limits

| Platform | Posts per Day | API Calls per Hour | Notes |
|----------|---------------|-------------------|-------|
| Instagram | 25 | 200 | Includes carousels (each image counts as 1 post) |
| Facebook Pages | 25 | 200 | Includes groups, events, and page content |
| Threads | 100 | 200 | Separate rate limit from Instagram/Facebook |
| All Platforms | - | 200/hour | Shared rate limit bucket |

### Rate Limit Details

- **Window**: Rolling 24-hour window for posts, sliding 1-hour window for API calls
- **Carousels**: Each image in a carousel counts as 1 post toward the daily limit
- **Error Handling**: HTTP 429 responses trigger automatic backoff with exponential retry (max 3 retries, 5s base delay)
- **Quota Reset**: Resets at 00:00 UTC for daily limits, hourly for API calls

### Burst Protection

- Maximum 5 posts in any 15-minute window per account
- Queue-based scheduling prevents accidental bursts
- Real-time quota monitoring with webhook alerts at 80% capacity

## Terms of Service Violations

### Explicitly Prohibited

| Activity | Status | Risk Level |
|----------|--------|------------|
| Auto-follow / auto-like | **BANNED** | Critical - account termination |
| Mass commenting/DMing | **BANNED** | Critical - account termination |
| Bot-like behavior detection | **BANNED** | Critical - permanent ban |
|购买/出售 accounts | **BANNED** | Critical - platform ban |
| Spammy hashtag stuffing | **DEPRECATED** | Medium - reduced reach |
| Excessive posting (>30/day) | **WARNING** | Medium - rate limiting |

### Gray Area (Use at Own Risk)

- **Scheduled posting in rapid succession**: Not explicitly banned but may trigger review
- **Automated comment responses**: Allow if 24h delay implemented between posts
- **AI-generated content**: Permitted if disclosed in caption ("AI-assisted")

## Mitigation Strategies

### 1. Quota Management

```
Daily Post Limits:
- Instagram: 25 posts (max 30 with 5h buffer)
- Facebook: 25 posts (max 30 with 5h buffer)
- Threads: 100 posts (max 120 with 20% buffer)
```

### 2. Smart Scheduling

- **Minimum interval**: 15 minutes between posts from same account
- **Maximum burst**: 3 posts per 15-minute window
- **Respect timezone**: Schedule based on user's local time, not server time
- **Night buffer**: No posts between 10pm-7am local time

### 3. Error Recovery

| Error Code | Action |
|------------|--------|
| 429 | Backoff + queue retry (max 3 attempts) |
| 10 | App reauthorization required |
| 190 | User token expired, prompt re-auth |
| 200 | Permission not granted, show permission dialog |
| 8000 | Meta system error, retry in 1h |

### 4. Rate Limit Headers

Track these response headers for proactive limiting:
```
X-App-Usage: {"call_count":45,"total_time":12,"total_cputime":10}
X-Business-Use-Case-Usage: {"call_count":10,"total_time":3}
X-Graph-API-Version: v19.0
```

## Cost Model

### Infrastructure Costs (per 1000 active users)

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| compute | $45 | 2x AWS t3.medium instances |
| database | $18 | RDS t3.medium PostgreSQL |
| storage | $5 | S3 + CloudFront for media assets |
| APIs | $30 | Meta API usage + caching layer |
| monitoring | $12 | Datadog/LogRocket subscription |
| bandwidth | $8 | CDN egress (50GB/mo) |
| **Total** | **$118** | ~$0.12/user/month |

### Per-Post Cost Breakdown

| Operation | Cost |
|-----------|------|
| Post creation | $0.002 |
| AI caption generation | $0.005 |
| Analytics update | $0.001 |
| Media upload (1MB) | $0.0005 |
| API call (cached) | $0.0001 |

### Free Tier Usage Limits

- **Posts**: 10/month (cost: $0.02-0.05/month)
- **Accounts**: 1 (shared infrastructure)
- **Analytics**: 30-day retention
- **Support**: Community forum only

### Pro/Agency Cost Considerations

- Dedicated compute instances: +$80/mo
- Priority Meta API access: +$50/mo (voluntary fee)
- Extended analytics retention (1 year): +$20/mo
- Custom reporting dashboards: +$15/mo

## Compliance Checklist

- [ ] All automated posts include opt-out link in caption
- [ ] No posts between 10pm-7am local time
- [ ] Maximum 25 posts per 24-hour window per account
- [ ] Rate limiting enforced at application level
- [ ] User tokens rotated every 60 days
- [ ] Webhooks re-verified weekly
- [ ] Monthly audit of Meta permissions
- [ ] logs retention: 90 days minimum for compliance

## Emergency Contact

| Issue | Contact | SLA |
|-------|---------|-----|
| API blocked | api-support@metaautomation.saas | 1 hour |
| Account flagged | compliance@metaautomation.saas | 4 hours |
| Rate limit exceeded | ops@metaautomation.saas | 15 minutes |
| Data corruption | security@metaautomation.saas | 30 minutes |
