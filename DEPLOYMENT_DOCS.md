# CourtAdmin — Deployment Documentation

Tracks every manual step required to stand up a fresh instance.
Steps marked **🤖 automatable** are candidates for the Phase 15 deploy script.

---

## Prerequisites

- Node.js 18+
- `npx wrangler` available (installed as a project dev dependency — no global install needed)
- A Cloudflare account with:
  - Workers & Pages enabled
  - D1 enabled
  - R2 enabled
  - Zero Trust / Cloudflare Access enabled (free tier is sufficient)
- A [Resend](https://resend.com) account with an API key

---

## URLs

| Service | URL |
|---|---|
| App (Worker + static frontend) | `https://courtadmin.seezed.net` |

---

## Step 1 — Cloudflare Access Application

**Dashboard path:** Cloudflare Zero Trust → Access → Applications → Add an application

Manual — cannot be fully automated via Wrangler CLI.

1. Click **Add an application** → choose **Self-hosted**
2. **Application name:** CourtAdmin
3. **Application domain:** `courtadmin.seezed.net`
4. **Identity providers:** select **One-time PIN** (email magic link / OTP — no third-party IdP needed)
5. **Policy:** create a policy:
   - Policy name: e.g. `Allow all`
   - Action: `Allow`
   - Rule: `Everyone` (any email can authenticate; roles are controlled in the app)
   - Alternatively, restrict to a specific email domain with rule `Emails ending in @seezed.net`
6. Save the application
7. On the application overview page, copy the **AUD tag** (Application Audience string)

---

## Step 2 — Worker Secrets & Vars

**🤖 automatable** (via `wrangler secret put` in deploy script)

```bash
# Cloudflare Access AUD tag (from Step 1)
npx wrangler secret put CF_ACCESS_AUD

# Resend API key (from resend.com → API Keys)
npx wrangler secret put RESEND_API_KEY

# Bootstrap admin email — the first login from this address is auto-provisioned with roles=["admin"]
npx wrangler secret put ADMIN_SEED_EMAIL
```

All commands prompt for the value interactively.

**How `ADMIN_SEED_EMAIL` works:** When a new user authenticates for the first time, the Worker checks whether their email matches this secret. If it does, they are provisioned with `roles = ["admin"]` instead of the default `roles = []`. The check only runs at first-provision (new account creation) — it has no effect on existing accounts, so changing the secret later does not affect any already-created users.

`RESEND_FROM_EMAIL` is set as a plain var in `wrangler.toml` (not a secret). The default is `onboarding@resend.dev` (works on Resend's free tier). For production, change it to a verified sender address on your Resend account, e.g. `noreply@yourdomain.com`.

---

## Step 3 — D1 Database

**🤖 automatable**

```bash
# Create the database
npx wrangler d1 create court-admin-db
```

Copy the `database_id` printed by the command and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "court-admin-db"
database_id = "<paste id here>"
```

Then apply migrations:

```bash
# Apply to remote (production) database
npx wrangler d1 migrations apply court-admin-db --remote

# Apply to local database (for local dev)
npx wrangler d1 migrations apply court-admin-db
```

**Current database ID:** `33198368-5fdc-497d-bd78-2c480c08b566` (region OC)

---

## Step 4 — R2 Bucket

**🤖 automatable**

```bash
npx wrangler r2 bucket create court-admin-assets
```

The bucket name `court-admin-assets` is already referenced in `wrangler.toml` — no further config needed.

---

## Step 5 — Build and Deploy

**🤖 automatable**

The frontend is bundled and served directly from the Worker via Workers Assets — no separate Pages project needed. A single command does both:

```bash
npm run deploy
# equivalent to: cd frontend && npm run build && cd .. && wrangler deploy
```

The Worker serves:
- `/api/*` → Worker code (Hono)
- Everything else → `frontend/dist` static files (React SPA)
- Unknown paths → `index.html` (SPA fallback, handles client-side routing)

---

## Step 6 — First Admin Login

No manual database seed is required. The `ADMIN_SEED_EMAIL` secret (set in Step 2) handles bootstrapping automatically.

1. Make sure `ADMIN_SEED_EMAIL` is set to the admin's email address.
2. The admin navigates to the app and signs in via Cloudflare Access (email OTP).
3. On first login the Worker auto-provisions their account with `roles = ["admin"]`.
4. All subsequent logins read the existing DB record — the secret has no further effect.

---

## Local Development

Run both servers in separate terminals:

```bash
# Terminal 1 — Wrangler Worker (API on http://localhost:8787)
npm run dev

# Terminal 2 — Vite frontend (http://localhost:5173, proxies /api/* to :8787)
npm run frontend:dev
```

The Vite dev server proxies `/api/*` and `/uploads/*` to `http://localhost:8787`, so relative API calls and R2-served image URLs work without any extra config.

For auth in local dev, the CF Access middleware accepts an `X-Dev-Email` header in place of the real `CF-Access-Authenticated-User-Email` header — **only** when `CF_ACCESS_AUD` secret is set to the literal string `dev`:

```bash
npx wrangler secret put CF_ACCESS_AUD
# enter: dev
```

Then pass the header in requests (browser extension, Vite plugin, or curl):
```
X-Dev-Email: you@example.com
```

---

## Re-running Migrations (after adding new migration files)

```bash
# Remote
npx wrangler d1 migrations apply court-admin-db --remote

# Local
npx wrangler d1 migrations apply court-admin-db
```

Wrangler tracks which migrations have already been applied and only runs new ones.

---

## Checklist — Fresh Instance

- [ ] Step 1: CF Access application created for `courtadmin.seezed.net`, AUD tag copied
- [ ] Step 2: Worker secrets set (`CF_ACCESS_AUD`, `RESEND_API_KEY`, `ADMIN_SEED_EMAIL`)
- [ ] Step 3: D1 database created, ID in `wrangler.toml`, migrations applied
- [ ] Step 4: R2 bucket created
- [ ] Step 5: `npm run deploy` — builds frontend and deploys Worker + static assets
- [ ] Step 6: Admin logs in for the first time — auto-provisioned with `roles = ["admin"]`
