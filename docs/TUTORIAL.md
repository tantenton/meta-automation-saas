# Tutorial

## User Guide

### 1. Connecting Your Social Accounts

1. Log in to your Meta Automation SaaS dashboard
2. Click "Add Account" from the dashboard
3. Select the platform (Facebook, Instagram, or Threads)
4. Click "Connect with Meta" and authorize with your Meta credentials
5. Select the pages/profiles you want to connect
6. Review permissions and click "Allow"

**Required Permissions:**
- `pages_read_engagement` - View analytics
- `pages_manage_posts` - Create and schedule posts
- `pages_manage_metadata` - AI caption generation
- `pages_show_list` - List your pages

### 2. Creating and Scheduling Posts

1. Click "Create Post" from the dashboard
2. Select the account(s) to post to
3. Add content:
   - Text caption (AI suggestion button available)
   - Upload images (JPG, PNG, GIF up to 5MB)
   - Add link (auto-generates link preview)
4. Configure settings:
   - **Schedule**: Set specific date/time or use "Optimal Time"
   - **Audience**: Select specific segments (Pro+)
   - **Optimize**: Enable AI caption optimization (Pro+)
5. Preview the post
6. Click "Schedule" or "Post Now"

### 3. Using AI Captions

1. Open the post composer
2. Add your base idea or keywords
3. Click the "AI Generate" button
4. Select tone: Professional, Casual, Promotional, Educational
5. Review and edit the generated caption
6. Click "Accept" to apply

**AI Provider Setup:**
- OpenAI (recommended): `gpt-4o-mini` for captions
- Anthropic: `claude-3-5-sonnet`
- Local model: Configure via `/settings/ai` endpoint

### 4. Analytics Dashboard

1. Navigate to "Analytics" in the sidebar
2. Select time range (7d, 30d, 90d, Custom)
3. View metrics:
   - **Reach**: Total impressions and unique viewers
   - **Engagement**: Likes, comments, shares, saves
   - **Follower Growth**: Net new followers
   - **Best Performing**: Top 5 posts by engagement rate

4. Export reports:
   - Click "Export CSV" for spreadsheet analysis
   - Click "Export PDF" for management reporting
   - Schedule automated weekly reports (Pro+)

### 5. Content Library

1. Click "Library" from the sidebar
2. Browse saved posts, templates, and media
3. Create new template:
   - Click "Create Template"
   - Save common post formats (promotional, educational, engagement)
4. Use templates:
   - Click "Use Template" when composing posts
   - Fill in dynamic placeholders

### 6. Team Collaboration (Pro/Agency)

1. Go to Settings > Team
2. Click "Invite Member"
3. Enter email and select role:
   - **Viewer**: Read-only access to analytics
   - **Editor**: Create and schedule posts
   - **Admin**: Full access including billing and settings
4. Team members receive email invitation
5. Accept invitation and configure profile

---

## Developer Guide

### 1. Local Development Setup

#### Requirements
- Node.js 18+ or Python 3.9+
- Docker and Docker Compose
- Git
- Meta Developer account

#### Step-by-Step Setup

```bash
# Clone repository
git clone https://github.com/meta-automation-saas/ma-saas.git
cd ma-saas

# Install dependencies
npm install
# or
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Start Docker services
docker-compose up -d
```

#### Environment Variables (`.env`)

```env
# Application
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/meta_automation

# Meta API
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
META_REDIRECT_URI=http://localhost:3000/api/auth/meta/callback

# AI Provider (optional)
OPENAI_API_KEY=sk-...

# Redis
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=debug
```

### 2. Meta App Configuration

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new App
3. Select "Business" type
4. Add "Facebook Login" product
5. Configure OAuth Settings:
   - OAuth Redirect URI: `http://localhost:3000/api/auth/meta/callback`
   - Default Redirect URL: `http://localhost:3000/dashboard`
6. Add required permissions:
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `pages_manage_metadata`
7. Add platforms:
   - Web Site: `http://localhost:3000`
8. Copy credentials to `.env`

### 3. Running the Application

#### Development Server

```bash
# Start backend API
npm run dev
# or
uvicorn main:app --reload

# Start frontend
npm run dev:frontend
```

The application will be available at `http://localhost:3000`

#### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

### 4. API Reference

#### Authentication

```http
POST /api/auth/meta/authorize
Authorization: Bearer {user_token}

Response: 200 OK
{
  "auth_url": "https://www.facebook.com/v19.0/dialog/oauth?client_id=...&redirect_uri=..."
}
```

#### Create Post

```http
POST /api/v1/posts
Authorization: Bearer {user_token}
Content-Type: application/json

{
  "account_id": "123456789",
  "message": "Check out our new product!",
  "image_url": "https://example.com/image.jpg",
  "schedule": "2024-01-15T14:00:00Z",
  "optimize_captions": true
}

Response: 201 Created
{
  "id": "post_123",
  "status": "scheduled",
  "meta_post_id": "123456789_987654321"
}
```

#### Get Analytics

```http
GET /api/v1/analytics/account/123456789?start=2024-01-01&end=2024-01-31
Authorization: Bearer {user_token}

Response: 200 OK
{
  "account_id": "123456789",
  "period": "month",
  "metrics": {
    "reach": 15420,
    "engagement": 892,
    "followers_gained": 234,
    "posts_count": 28
  }
}
```

### 5. Deployment

#### Docker Deployment

```bash
# Build image
docker build -t meta-automation-saas .

# Run container
docker run -p 3000:3000 \
  -e META_APP_ID=... \
  -e META_APP_SECRET=... \
  -e DATABASE_URL=... \
  meta-automation-saas
```

#### Production Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/
```

#### Environment Variables (Production)

```env
NODE_ENV=production
SECURE_COOKIES=true
SESSION_SECRET=strong_random_string
```

### 6. Troubleshooting

#### Common Issues

**"Invalid Meta App Credentials"**
- Verify `META_APP_ID` and `META_APP_SECRET` in `.env`
- Check Meta App is not in Development mode
- Ensure OAuth Redirect URI matches exactly

**Rate Limit Exceeded**
- System automatically handles rate limiting
- If persistent: reduce posting frequency or upgrade plan

**Post Not Publishing**
- Check Meta Account permissions are still valid
- Verify image URLs are publicly accessible
- Review error logs: `docker-compose logs`

### 7. Extending the Platform

#### Adding New Social Platforms

1. Create auth adapter in `src/auth/adapters/`
2. Implement platform-specific post creation
3. Add permissions mapping
4. Update `src/platforms/index.ts` with new adapter

#### Custom AI Prompts

Edit `src/ai/prompts.ts` to customize:

```typescript
export const CAPTION_PROMPT = `
You are a social media expert. Create an engaging caption for: {content}
Format: 1-2 sentences, 3-5 relevant hashtags
Tone: {tone}
`;
```
