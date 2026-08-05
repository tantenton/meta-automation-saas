# Meta Automation SaaS — Architecture

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Auth | NextAuth 5 (Meta OAuth) |
| AI API | 9router (self-hosted) |
| External APIs | Meta Graph API (Instagram + Threads) |
| Deployment | Vercel (frontend) + VPS (scheduler cron) |
| Monitoring | Sentry (errors) + UptimeRobot (uptime) |

## Project Structure

```
meta-automation-saas/
├── app/
│   ├── (dashboard)/              # Protected routes (auth required)
│   │   ├── page.tsx              # Dashboard home
│   │   ├── analytics/page.tsx    # Analytics dashboard
│   │   ├── settings/page.tsx     # Account settings
│   │   └── layout.tsx
│   ├── api/                      # Next.js API Routes
│   │   ├── auth/[...nextauth]/   # Meta OAuth callback
│   │   ├── posts/
│   │   │   ├── schedule/route.ts # Schedule post
│   │   │   └── list/route.ts     # List posts
│   │   └── accounts/
│   │       ├── connect/route.ts  # OAuth callback
│   │       └── list/route.ts     # Connected accounts
│   └── layout.tsx
├── components/                   # React components
│   ├── dashboard/                # Dashboard UI
│   │   ├── PostCalendar.tsx
│   │   ├── AnalyticsChart.tsx
│   │   └── AccountCard.tsx
│   └── ui/                       # shadcn/ui components
├── lib/                          # Application logic
│   ├── meta-api/                 # Meta Graph API wrapper
│   │   ├── auth.ts               # OAuth + token refresh
│   │   ├── posts.ts              # Publish/schedule
│   │   ├── analytics.ts          # Insights fetch
│   │   └── rate-limit.ts         # 429 handling
│   ├── ai/                       # 9router integration
│   │   ├── caption.ts            # AI caption generation
│   │   └── hashtag.ts            # Hashtag suggestions
│   ├── supabase/                 # DB client + types
│   └── utils/                    # Helpers
├── supabase/
│   └── schema.sql                # DB schema + RLS
├── public/
├── .env.example
├── ARCHITECTURE.md               # This file
└── package.json
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/callback/meta` | GET | Meta OAuth callback |
| `/api/accounts/connect` | POST | Connect Instagram/Threads |
| `/api/accounts/list` | GET | List connected accounts |
| `/api/posts/schedule` | POST | Schedule post |
| `/api/posts/list` | GET | List posts |
| `/api/analytics` | GET | Fetch analytics |
| `/api/ai/caption` | POST | Generate AI caption |

## Database Schema

**users** — User profiles
**accounts** — Instagram/Threads/Facebook accounts
**posts** — Posts queue (draft/scheduled/published/failed)
**analytics** — Daily insights (reach, impressions, likes, etc.)

## Deployment

### Vercel (Frontend + API)
```bash
vercel --prod
```

Environment variables:
- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `META_APP_ID`
- `META_APP_SECRET`
- `ROUTER_BASE_URL`
- `CRON_SECRET`

### VPS (Scheduler Cron)
Systemd service `/etc/systemd/system/meta-scheduler.service`:
- Runs every 5 minutes
- Checks `scheduled_at <= now AND status='scheduled'`
- Publishes via Meta Graph API

## Monitoring

| Metric | Tool | Alert Threshold |
|--------|------|-----------------|
| Uptime | UptimeRobot | < 99.9% |
| Errors | Sentry | 5+ errors/10min |
| Rate limits | Custom | > 80% of limit |
| RAM usage | VPS | > 85% |

## Security

- **RLS policies** on all tables (owner-only access)
- **NextAuth** for OAuth (no manual token storage)
- **API keys** in `.env`, never committed
- **Rate limiting** per account (25 IG posts/day, 100 Threads/day)
- **Token expiry** auto-refresh (60-day limit)
