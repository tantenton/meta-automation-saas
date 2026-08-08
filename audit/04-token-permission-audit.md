# Token & Permission Audit for Instagram Integration

**Date:** 2026-08-06  
**Project:** BirruLabs Social Media Automation  
**Meta App ID:** 1076777758636119 (Facebook)  
**Threads App ID:** 2078424476129562

---

## 1. Current OAuth Scopes

From `lib/meta-api/auth.ts` (line 39):
```
email,public_profile,instagram_basic,instagram_content_publish,threads_basic,threads_content_publish,pages_show_list
```

### Scope Analysis

| Scope | Required for Instagram | Purpose |
|-------|------------------------|---------|
| `instagram_basic` | ✅ Yes | Read Instagram Business/Creator account info |
| `instagram_content_publish` | ✅ Yes | Publish content to Instagram (organic) |
| `pages_show_list` | ⚠️ Conditional | Required only for Instagram **Business** accounts (connected to FB Page) |
| `instagram_business_basic` | ❌ Not used | Alternative scope for Instagram Login (requires Instagram product in app) |
| `instagram_business_content_publish` | ❌ Not used | Alternative scope for publishing via Instagram Login |

---

## 2. Route A vs Route B: Instagram vs Facebook Login

### Route A: Instagram Login (Direct to Instagram Professional)
- **Scopes:** `instagram_business_basic`, `instagram_business_content_publish`
- **Auth URL:** `https://api.instagram.com/oauth/authorize`
- **Facebook Page required?** ❌ No
- **Account type:** Instagram Professional (Creator or Business)
- **App configuration:** Requires "Instagram Login" product in Meta app
- **Token endpoint:** `https://graph.instagram.com/oauth/access_token`

### Route B: Facebook Login (via Facebook Page)
- **Scopes:** `instagram_basic`, `instagram_content_publish`, `pages_show_list`
- **Auth URL:** `https://www.facebook.com/v19.0/dialog/oauth`
- **Facebook Page required?** ✅ Yes (for Instagram Business account)
- **Account type:** Instagram Business (must be connected to Facebook Page)
- **App configuration:** Requires "Facebook Login" product (current setup)
- **Token endpoint:** `https://graph.facebook.com/v19.0/oauth/access_token`

---

## 3. Current Implementation Route

**The codebase uses Route B (Facebook Login).**

Evidence:
1. `lib/meta-api/auth.ts` line 34: Uses `https://www.facebook.com/v19.0/dialog/oauth`
2. `lib/meta-api/auth.ts` line 124: Fetches `instagram_business_account` from Facebook Graph
3. `lib/meta-api/auth.ts` line 39: Includes `pages_show_list` scope (FB Page requirement)
4. Uses `META_APP_ID` (1076777758636119) — configured as Facebook Login product

**Problem:** Owner has Instagram Professional account, likely as a **Creator** account (not connected to Facebook Page).

---

## 4. Does Instagram Posting REQUIRE a Facebook Page?

### Official Meta Requirements (2026)

**For Instagram Graph API:**

| Account Type | Facebook Page Required | API Route |
|--------------|------------------------|-----------|
| Instagram **Business** | ✅ Yes | `instagram_business_account` via Facebook Graph |
| Instagram **Creator** | ❌ No | `ig_user` via Instagram Graph (requires Instagram Login product) |

**Key distinction:**
- `instagram_business_account` field only exists for Instagram **Business** accounts (which require Facebook Page)
- `ig_user` field exists for **Creator** accounts (standalone, no Facebook Page needed)

---

## 5. Minimum Permissions for Organic Posting Only

### Option 1: Instagram Login (Creator Account Friendly)
```
Scopes:
- instagram_basic (or instagram_business_basic)
- instagram_content_publish (or instagram_business_content_publish)

No Facebook Page required.

App must have "Instagram Login" product configured.
```

### Option 2: Facebook Login (Business Account Only)
```
Scopes:
- instagram_basic
- instagram_content_publish
- pages_show_list (mandatory for Business account access)

Facebook Page required.
```

---

## 6. Current Configuration Issues

### Problem 1: App Product Type
- Current app (1076777758636119) is configured with **Facebook Login**
- Missing **Instagram Login** product
- This forces Route B (Facebook Page required)

### Problem 2: Token Endpoint
- Current: `https://graph.facebook.com/v19.0/oauth/access_token` (Facebook token)
- For Creator accounts: Need `https://graph.instagram.com/oauth/access_token` (Instagram token)

### Problem 3: User Endpoint
- Current: `graph.facebook.com/{userId}?fields=instagram_business_account{...}`
- For Creator accounts: Need `graph.instagram.com/{ig-user-id}?fields=...`

---

## 7. Recommendations

### Short-Term Fix (Zero Code Changes)
1. Convert owner's Instagram Professional to **Business** account
2. Connect Instagram Business to a Facebook Page
3. Ensure Facebook Page has "Instagram" connected in Page Settings
4. Submit app for App Review with:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`

### Medium-Term Fix (Code Changes)
1. Add Instagram Login product to Meta app (1076777758636119 or new app)
2. Modify OAuth to support both routes:
   - Detect account type first
   - Use appropriate scopes and endpoints
3. Handle `ig_user` for Creator accounts
4. Handle `instagram_business_account` for Business accounts

### Long-Term Fix (Multi-App Strategy)
- Keep current app for Facebook/Threads (1076777758636119)
- Create new app with Instagram Login product for Instagram-only
- This allows cleaner scope separation and App Review

---

## 8. Audit Summary Table

| Question | Answer |
|----------|--------|
| Does current code support Instagram? | ✅ Yes (platform enum present) |
| Does it require Facebook Page? | ✅ Yes (uses Business account route) |
| Can Creator accounts work as-is? | ❌ No (missing `ig_user` endpoint) |
| What scopes are currently used? | `instagram_basic,instagram_content_publish,pages_show_list` |
| Are scopes sufficient for organic posting? | ✅ Yes (but require Business account + Facebook Page) |
| What app product is configured? | Facebook Login (not Instagram Login) |
| Error `"Business Account Not Allowed to Advertise"` cause? | Business account is new, unsigned, or Creator account being treated as Business |

---

## 9. Files Reviewed

| File | Relevance |
|------|-----------|
| `lib/meta-api/auth.ts` | OAuth flow, scopes, user/Instagram endpoint |
| `lib/meta-api/client.ts` | Instagram Graph API calls (v19.0) |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth integration |
| `app/api/v1/accounts/route.ts` | Account connection schema |
| `supabase/schema.sql` | Database supports `instagram` platform |

---

**Audit complete. No changes made.**
