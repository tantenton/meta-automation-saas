# Instagram Account Audit

**Date:** 2026-08-06  
**Project:** BirruLabs Social Media Automation (meta-automation-saas)  
**Purpose:** Read-only assessment of Instagram integration readiness

---

## 1. Codebase Supports Instagram Platform

**Evidence:**

- `lib/meta-api/auth.ts` (lines 34-40): OAuth URL includes `scope` with:
  - `instagram_basic`
  - `instagram_content_publish`
- `lib/meta-api/auth.ts` (lines 123-136): `getInstagramAccount()` fetches `instagram_business_account` from user profile via `graph.facebook.com/{userId}?fields=instagram_business_account{...}`
- `lib/meta-api/client.ts` (lines 39-64): Instagram container creation and publishing functions
- `app/api/v1/accounts/route.ts` (line 9): Schema accepts `platform: 'instagram' | 'threads'`
- `components/dashboard/ConnectAccountModal.tsx` (line 8): Instagram UI button exists
- `supabase/schema.sql` (line 24): Accounts table supports `instagram` platform

---

## 2. Required Permissions (OAuth Scopes)

Current scopes in `lib/meta-api/auth.ts`:
```
email,public_profile,instagram_basic,instagram_content_publish,threads_basic,threads_content_publish,pages_show_list
```

| Scope | Purpose |
|-------|---------|
| `instagram_basic` | Read Instagram Business/Creator account info |
| `instagram_content_publish` | Publish content to Instagram (organic only) |
| `pages_show_list` | Required to get Facebook Page list for Business accounts |

---

## 3. Instagram Account Types Supported

The code supports **Instagram Professional accounts** via two routes:

### Route A: Instagram Business Account (via Facebook Login)
- Requires user to have an Instagram Business account **connected to a Facebook Page**
- Endpoint: `GET graph.facebook.com/{userId}?fields=instagram_business_account{...}`
- This is the route the current code uses

### Route B: Instagram Creator Account (direct)
- Direct Instagram account without Facebook Page
- Requires different endpoint or app configuration (not currently implemented)

**Current behavior:** Code expects `instagram_business_account` field, which only exists on Instagram **Business** accounts linked to a Facebook Page.

---

## 4. Account Linkage Flow

1. User logs in via Facebook OAuth (uses `META_APP_ID`: 1076777758636119)
2. System fetches user profile with `fields=instagram_business_account{...}`
3. If `instagram_business_account` exists, extract `id` and `username`
4. Store Instagram account in `accounts` table with `platform='instagram'`
5. Publishing uses Graph API v19.0 endpoints:
   - `POST /{instagramUserId}/media` — create container
   - `POST /{instagramUserId}/media_publish` — publish container

---

## 5. Critical Findings

### Problem 1: Requires Facebook Page
Instagram **Professional** accounts can be:
- **Business** (must be connected to Facebook Page)
- **Creator** (standalone, no Facebook Page)

Current code only handles **Business** accounts because:
- `getInstagramAccount()` uses `instagram_business_account` field
- OAuth scope `pages_show_list` is present (required for Business accounts)
- No handling for standalone Creator accounts

### Problem 2: Error Message Pattern
Error `"Business Account Not Allowed to Advertise"` occurs because:
- Owner has Instagram Professional account
- If it's a **Creator** account (not connected to FB Page), Facebook rejects certain API calls
- Or: Business account is new/unsigned, missing required permissions

### Problem 3: App Configuration Unknown
- `META_APP_ID` (1076777758636119): Facebook app — must have Instagram Basic Display + Instagram Login products enabled
- `Threads App ID` (2078424476129562): Separate app for Threads
- Instagram requires Facebook app to be configured with Instagram Login product

---

## 6. Recommendation

**To support organic posting only:**

1. Verify owner's Instagram account type:
   - Go to Instagram > Profile > Settings > Account > switch to Professional
   - Check if "Business" or "Creator"
   - If "Business", ensure it's connected to a Facebook Page

2. If using **Creator account only**, need to:
   - Remove dependency on `instagram_business_account` field
   - Use `ig_user` endpoint instead (requires Instagram Login product)
   - Or use Threads App ID (2078424476129562) for Creator accounts

3. Minimum scopes for organic posting:
   - `instagram_basic` (required)
   - `instagram_content_publish` (required for publishing)
   - Remove `pages_show_list` if not using Business account

---

## 7. Files Reviewed

| File | Purpose |
|------|---------|
| `lib/meta-api/auth.ts` | OAuth handler, token exchange, Instagram account fetching |
| `lib/meta-api/client.ts` | Graph API clients for Instagram/Threads posting |
| `app/api/v1/accounts/route.ts` | Account connection endpoint |
| `components/dashboard/ConnectAccountModal.tsx` | UI for platform selection |
| `supabase/schema.sql` | Database schema |

---

**No changes made. Audit complete.**
