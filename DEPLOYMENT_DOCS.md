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
```

Both commands prompt for the value interactively.

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

## Step 6 — Seed the Admin User

**🤖 automatable**

Insert the first admin user directly into D1. Replace the email and name with the real values.

```bash
npx wrangler d1 execute court-admin-db --remote --command \
  "INSERT INTO users (id, email, first_name, last_name, roles, is_active, created_at, updated_at)
   VALUES (lower(hex(randomblob(16))), 'admin@yourdomain.com', 'Admin', 'User', '[\"admin\"]', 1, datetime('now'), datetime('now'))
   ON CONFLICT(email) DO UPDATE SET roles = '[\"admin\"]';"
```

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
- [ ] Step 2: Worker secrets set (`CF_ACCESS_AUD`, `RESEND_API_KEY`)
- [ ] Step 3: D1 database created, ID in `wrangler.toml`, migrations applied
- [ ] Step 4: R2 bucket created
- [ ] Step 5: `npm run deploy` — builds frontend and deploys Worker + static assets
- [ ] Step 6: Admin user seeded
