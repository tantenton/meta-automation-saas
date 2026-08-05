# Architecture & Handoff Guide

## System Architecture

### High-Level Diagram

```
+------------------+     +------------------+     +------------------+
|   User Browser   |     |   Frontend App   |     |   Backend API    |
|   (React/NextJS) |     |   (Vite/React)   |     |   (Node.js)      |
+------------------+     +------------------+     +------------------+
         |                        |                        |
         |                        |                        |
         +------------------------+------------------------+
                                  |
                    +-------------+-------------+
                    |         API Gateway         |
                    |    (Rate Limit, Auth)       |
                    +-------------+-------------+
                                  |
         +------------------------+------------------------+
         |                        |                        |
+------------------+     +------------------+     +------------------+
|   Meta Platform  |     |   AI Service     |     |   Database       |
|   (FB/IG/Thread) |     |   (LLM)          |     |   (PostgreSQL)   |
+------------------+     +------------------+     +------------------+
         |                        |                        |
         |                        |                        |
+------------------+     +------------------+     +------------------+
|   Redis Cache    |     |   Queue Worker   |     |   Monitoring     |
|   (Sessions)     |     |   (Resend Failed)|     |   (Datadog)      |
+------------------+     +------------------+     +------------------+
```

### Component Details

#### 1. Frontend (React + NextJS)
- Authentication flow with Meta OAuth
- Post composer with drag-drop media upload
- Analytics dashboard with Chart.js
- Team management interface

#### 2. Backend (Node.js + Express)
- RESTful API endpoints
- OAuth2 flow management
- Rate limiting middleware
- Webhook handlers for Meta events

#### 3. Meta Integration Layer
- Meta Graph API SDK wrapper
- Automatic token refresh
- Rate limit tracking and throttling
- Error classification and retry logic

#### 4. AI Service
- OpenAI/Anthropic integration
- Caption generation
- Hashtag optimization
- Sentiment analysis

#### 5. Database (PostgreSQL)
- User accounts and connections
- Scheduled posts queue
- Analytics data
- Audit logs

#### 6. Queue System
- BullMQ for job processing
- Post scheduling queue
- Retry mechanism for failed posts
- Email notifications

## Code Conventions

### TypeScript/JavaScript

```typescript
// Naming conventions
const UPPER_CASE_CONSTANTS = true;
const camelCaseVariables = true;
const PascalCaseClasses = true;

// Async/await pattern
async function createPost(data: PostData): Promise<PostResponse> {
  try {
    const result = await metaClient.create(data);
    return result;
  } catch (error) {
    logError(error);
    throw handleMetaError(error);
  }
}

// Error handling pattern
interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

function handleMetaError(error: Error): AppError {
  if (error.message.includes('429')) {
    return { code: 'RATE_LIMIT', message: 'Rate limit exceeded' };
  }
  return { code: 'UNKNOWN', message: 'Unknown error' };
}
```

### Python (Backend Services)

```python
# Type hints required
from typing import Optional, Dict, Any

class PostService:
    async def create_post(
        self,
        account_id: str,
        message: str,
        image_url: Optional[str] = None,
    ) -> PostResponse:
        try:
            result = await self.meta_client.create(
                account_id=account_id,
                message=message,
                image_url=image_url,
            )
            return result
        except MetaAPIError as e:
            self._log_error(e)
            raise self._handle_error(e)

def handle_error(error: MetaAPIError) -> AppError:
    if error.status_code == 429:
        return AppError(code="RATE_LIMIT", message="Rate limit exceeded")
    return AppError(code="UNKNOWN", message="Unknown error")
```

### Code Quality

- **Linting**: ESLint + Prettier for JS/TS, Ruff for Python
- **Testing**: Jest (80% coverage minimum), PyTest
- **Formatting**: 2-space indent, single quotes, semicolons required
- **Branch naming**: `feature/`, `fix/`, `refactor/`, `docs/`

### File Structure

```
src/
├── api/              # API endpoints
│   ├── v1/
│   │   ├── posts/
│   │   │   ├── index.ts
│   │   │   └── create.post.ts
│   │   └── analytics/
│   ├── auth/
│   │   └── meta/
│   └── index.ts
├── services/         # Business logic
│   ├── post.service.ts
│   ├── analytics.service.ts
│   └── ai.service.ts
├── clients/          # External service clients
│   ├── meta.client.ts
│   ├── redis.client.ts
│   └── ai.client.ts
├── middleware/       # Express middleware
│   ├── rate-limiter.ts
│   ├── auth.middleware.ts
│   └── error-handler.ts
├── models/           # Database models
│   ├── user.model.ts
│   ├── post.model.ts
│   └── analytics.model.ts
├── types/            # TypeScript types
│   ├── index.d.ts
│   └── meta.d.ts
└── utils/
    ├── date.utils.ts
    ├── error.utils.ts
    └── validation.utils.ts
```

## Database Schema

### Tables

```sql
-- Users and Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    plan VARCHAR(50) DEFAULT 'free',
    status VARCHAR(20) DEFAULT 'active'
);

-- Meta Account Connections
CREATE TABLE meta_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('facebook', 'instagram', 'threads')),
    account_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,
    refresh_token TEXT,
    permissions TEXT[],
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active'
);

-- Scheduled Posts
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meta_account_id UUID REFERENCES meta_accounts(id),
    user_id UUID REFERENCES users(id),
    meta_post_id TEXT,
    message TEXT NOT NULL,
    image_url TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'publishing', 'published', 'failed', 'cancelled')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    analytics JSONB
);

-- Analytics Data (denormalized for performance)
CREATE TABLE analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meta_account_id UUID REFERENCES meta_accounts(id),
    post_id UUID REFERENCES posts(id),
    date DATE NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate Limit Tracking
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meta_account_id UUID REFERENCES meta_accounts(id),
    endpoint VARCHAR(100) NOT NULL,
    requests_this_hour INTEGER DEFAULT 0,
    last_reset TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(meta_account_id, endpoint)
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_posts_scheduled_at ON posts(scheduled_at);
CREATE INDEX idx_posts_meta_account_id ON posts(meta_account_id);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_analytics_account_date ON analytics(meta_account_id, date);
CREATE INDEX idx_rate_limits_account ON rate_limits(meta_account_id);
```

## Troubleshooting

### Common Issues

#### 1. Meta OAuth Not Working

**Symptoms:** User redirected back with error, no token received

**Diagnosis:**
```bash
# Check environment variables
grep META_APP /app/.env

# Verify redirect URI matches Meta app settings
curl -s "https://graph.facebook.com/v19.0/app?access_token=$META_APP_ID|$META_APP_SECRET" | jq .
```

**Fix:**
- Ensure OAuth Redirect URI in Meta app matches exactly
- Check Meta app is live (not in Development mode)
- Verify domain is whitelisted in Meta app settings

#### 2. Rate Limit Errors

**Symptoms:** HTTP 429 responses, posts failing to publish

**Diagnosis:**
```bash
# Check current rate limit usage
curl -sI "https://graph.facebook.com/v19.0/$ACCOUNT_ID?access_token=$TOKEN" | grep -i x-app-usage
```

**Fix:**
- System automatically throttles (already implemented)
- Reduce posting frequency
- Upgrade plan for higher limits
- Wait for quota reset (1 hour)

#### 3. Token Expiration

**Symptoms:** Posts fail with "Invalid OAuth token" error

**Diagnosis:**
```bash
# Check token validity
curl -s "https://graph.facebook.com/debug_token?input_token=$TOKEN&access_token=$META_APP_ID|$META_APP_SECRET" | jq .
```

**Fix:**
- Auto-refresh implemented in `meta.client.ts`
- User must re-authenticate if refresh fails
- Implement token refresh UI prompt

#### 4. AI Caption Generation Failed

**Symptoms:** Empty or error caption

**Diagnosis:**
- Check AI API key: `grep OPENAI_API_KEY .env`
- Verify AI service is running: `curl http://localhost:8001/health`
- Check logs: `docker-compose logs ai-service`

**Fix:**
- Update API key if expired
- Check AI service quota
- Fallback to generic template

### Debug Mode

Enable debug logging:

```bash
# Set log level
export LOG_LEVEL=debug

# View real-time logs
docker-compose logs -f backend
```

### Health Check Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/health/database` | GET | Database connectivity |
| `/health/redis` | GET | Redis connectivity |
| `/health/meta` | GET | Meta API connectivity |
| `/health/ai` | GET | AI service status |

## Deployment Process

### Production Deployment

#### 1. Pre-Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] Code reviewed and merged to `main`
- [ ] Environment variables configured
- [ ] Database migrations run (`npm run db:migrate`)
- [ ] Backup created (`pg_dump`)

#### 2. Deployment Steps

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm ci

# Run migrations
npm run db:migrate

# Build application
npm run build

# Start services
pm2 restart all
# or
docker-compose up -d

# Verify health
curl -s https://app.metaautomation.saas/health | jq .
```

#### 3. Rollback Procedure

```bash
# Stop services
pm2 stop all

# Restore from backup
git reset --hard HEAD~1

# Rebuild
npm ci && npm run build

# Restart
pm2 restart all

# Verify
curl -s https://app.metaautomation.saas/health
```

### Continuous Deployment

#### Pipeline Stages

```yaml
name: CI/CD Pipeline

stages:
  - name: Test
    script: npm ci && npm test && npm run lint

  - name: Build
    script: npm run build

  - name: Deploy Staging
    script: |
      git push origin HEAD:staging
      ssh staging-server "cd /app && ./deploy.sh"

  - name: Deploy Production
    script: |
      ssh prod-server "cd /app && ./deploy.sh"
```

### Monitoring

#### Key Metrics

| Metric | Alert Threshold | Dashboard |
|--------|-----------------|-----------|
| API Error Rate | >1% | `/dashboards/api-errors` |
| Post Failure Rate | >5% | `/dashboards/post-failures` |
| Rate Limit Usage | >80% | `/dashboards/rate-limits` |
| Database Connections | >80% max | `/dashboards/database` |
| Response Time (p95) | >2s | `/dashboards/performance` |

#### Alert Channels

- Slack: `#ops-alerts`
- PagerDuty: Critical only (API down, data corruption)
- Email: `ops@metaautomation.saas`

### Backup Strategy

- **Database**: Daily snapshots, 30-day retention
- **Media Files**: S3 lifecycle policy, 90-day standard, 1 year archive
- **Configuration**: Version controlled in Git
- **Disaster Recovery**: 24-hour RTO, 4-hour RPO
