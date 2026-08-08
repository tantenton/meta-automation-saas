# Security Audit Report - BirruLabs Meta Automation

**Date:** 2026-08-06  
**Project:** `meta-automation-saas`  
**Auditor:** Automated Security Scan  
**Scope:** Read-only analysis of git history, file permissions, env files, and runtime configuration

---

## Executive Summary

**Overall Risk Level:** Medium

- No secrets found in git history (`.env` files never committed)
- File permissions on `.env.local` are properly restricted (`600`)
- `.gitignore` correctly excludes `.env*` files
- Docker container exposes sensitive environment variables
- Systemd logs show no token exposure

---

## Detailed Findings

### 1. Git History Secret Scan ✅

| Check | Result |
|-------|--------|
| `.env` files ever committed | **No** |
| Suspicious commits with secrets | **None found** |

Git history is clean. No `.env`, `.env.local`, or `.env.production` files were committed to the repository.

**Recent commits (last 20):**
- `bfcd105` - Threads API v1.0 endpoint fix
- `0000e2a` - v1 API feature addition
- `00b5f82` - Initial commit from Create Next App

### 2. File Permission Check ✅

| File | Permissions | Owner |
|------|-------------|-------|
| `.env.local` | `-rw-------` (600) | ubuntu:ubuntu |

File permissions are correctly set to owner-only read/write.

### 3. .gitignore Verification ✅

`.gitignore` includes: `# env files (can opt-in for committing if needed)\n.env*`

This pattern correctly excludes all `.env*` files from version control.

### 4. Environment Variables Detected

**In `.env.local` (18 variables):**
```
NEXT_PUBLIC_APP_URL
HERMES_API_KEY
CRON_SECRET
HERMES_OWNER_USER_ID
TOKEN_ENCRYPTION_KEY
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_MEDIA_BUCKET
MAX_UPLOAD_BYTES
META_GRAPH_VERSION
META_STATUS_POLL_MS
META_STATUS_MAX_ATTEMPTS
POST_MAX_ATTEMPTS
ROUTER_BASE_URL
ROUTER_API_KEY
NEXTAUTH_SECRET
META_APP_ID
META_APP_SECRET
META_REDIRECT_URI
DATABASE_URL
VERCEL_OIDC_TOKEN
```

**In Docker Container (14 variables):**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
META_APP_ID
META_APP_SECRET
META_REDIRECT_URI
NEXTAUTH_URL
NEXTAUTH_SECRET
ROUTER_BASE_URL
ROUTER_API_KEY
PATH
NODE_VERSION
YARN_VERSION
NODE_ENV
PORT
HOSTNAME
```

**Sensitive variables exposed in Docker:**
- `META_APP_SECRET`
- `ROUTER_API_KEY`
- `NEXTAUTH_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY` (in `.env.local`, not in Docker)

### 5. Systemd Logs Check ✅

No token exposure detected in `meta-worker.service` logs.

---

## Recommendations

### Critical Actions

1. **Docker Environment Variables**
   - Currently, Docker container exposes sensitive variables (`META_APP_SECRET`, `ROUTER_API_KEY`, etc.)
   - **Action:** Use Docker secrets or environment file mounts instead of hardcoding in `docker run`/compose
   - **Reference:** `docker inspect meta-saas` shows plaintext env vars

2. **Token Encryption Key**
   - `TOKEN_ENCRYPTION_KEY` found in `.env.local`
   - **Action:** Verify key is at least 32 bytes for AES-256

### Medium Priority

3. **Supabase Service Role Key**
   - Exposed in `.env.local` and Docker
   - **Action:** Ensure this key has minimal required permissions (row-level security)

4. **HerMES API Key**
   - `HERMES_API_KEY` and `HERMES_OWNER_USER_ID` present
   - **Action:** Audit which services use these and rotate if compromised

### Low Priority / Best Practices

5. **Systemd Service**
   - No token exposure in logs (verified)
   - **Recommendation:** Add `ProtectSystem=strict` and `PrivateTmp=true` to service file

6. **Git History**
   - Clean history (no committed secrets)
   - **Recommendation:** Consider `git gc --prune=now` periodically for optimization

---

## Compliance Checklist

| Item | Status |
|------|--------|
| No secrets in git history | ✅ Pass |
| `.env.local` permissions correct | ✅ Pass |
| `.gitignore` excludes `.env*` | ✅ Pass |
| Token exposure in logs | ✅ Pass |
| Docker secrets exposed | ⚠️ Warning |
| Encryption key strength | ❓ Verify |
| RLS enabled on Supabase | ❓ Verify |

---

## Notes

- This audit is **read-only**. No changes were made to files or configuration.
- Do **not** rotate secrets based on this report alone. Follow your organization's secret rotation policy.
- Docker deployment should use secret management (Docker secrets, HashiCorp Vault, etc.) instead of environment variables for production.

---

*Report generated automatically by Hermes Agent security scan.*
