#!/usr/bin/env bash
set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       CourtAdmin — Fresh Deploy          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Preflight ────────────────────────────────────────────────────────────────

if ! command -v npx &>/dev/null; then
  echo "✗ npx not found. Install Node.js first." && exit 1
fi

if ! npx wrangler --version &>/dev/null; then
  echo "✗ wrangler not found. Run: npm install" && exit 1
fi

# ── Credentials ──────────────────────────────────────────────────────────────

read -p "Cloudflare Account ID: " CF_ACCOUNT_ID
read -p "Resend API Key: " RESEND_API_KEY
read -p "Admin email address (first admin user): " ADMIN_EMAIL
read -p "App domain (e.g. court-admin.example.com): " APP_DOMAIN

echo ""

# ── D1 Database ──────────────────────────────────────────────────────────────

echo "▶ Creating D1 database..."
DB_OUTPUT=$(npx wrangler d1 create court-admin-db --account-id "$CF_ACCOUNT_ID" 2>&1 || true)
DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id = "\K[^"]+' || true)

if [ -z "$DB_ID" ]; then
  echo "  D1 database may already exist. Checking..."
  DB_ID=$(npx wrangler d1 list --account-id "$CF_ACCOUNT_ID" 2>&1 \
    | grep "court-admin-db" | awk '{print $1}' || true)
fi

if [ -z "$DB_ID" ]; then
  echo "✗ Could not determine D1 database ID. Check wrangler output above." && exit 1
fi

echo "  Database ID: $DB_ID"
sed -i "s/REPLACE_WITH_D1_DATABASE_ID/$DB_ID/" wrangler.toml

# ── D1 Migrations ────────────────────────────────────────────────────────────

echo "▶ Running D1 migrations..."
npx wrangler d1 migrations apply court-admin-db --account-id "$CF_ACCOUNT_ID"

# ── R2 Bucket ────────────────────────────────────────────────────────────────

echo "▶ Creating R2 bucket..."
npx wrangler r2 bucket create court-admin-assets --account-id "$CF_ACCOUNT_ID" 2>&1 || \
  echo "  R2 bucket may already exist — continuing."

# ── Secrets ──────────────────────────────────────────────────────────────────

echo "▶ Setting Worker secrets..."
echo "$RESEND_API_KEY" | npx wrangler secret put RESEND_API_KEY
echo "$CF_ACCOUNT_ID"  | npx wrangler secret put CF_ACCESS_AUD  # placeholder — update after CF Access app is created

# ── Worker Deploy ─────────────────────────────────────────────────────────────

echo "▶ Deploying Worker..."
npx wrangler deploy

# ── Frontend Build + Pages Deploy ────────────────────────────────────────────

echo "▶ Building frontend..."
cd frontend && npm run build && cd ..

echo "▶ Deploying to Cloudflare Pages..."
npx wrangler pages deploy frontend/dist --project-name court-admin

# ── Seed Admin User ───────────────────────────────────────────────────────────

echo "▶ Seeding admin user ($ADMIN_EMAIL)..."
npx wrangler d1 execute court-admin-db --command \
  "INSERT OR IGNORE INTO users (email, first_name, last_name, roles, is_active, is_approved)
   VALUES ('$ADMIN_EMAIL', 'Admin', 'User', '[\"admin\"]', 1, 1);"

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "✓ Deploy complete."
echo ""
echo "  Worker:   https://court-admin.<your-subdomain>.workers.dev"
echo "  Pages:    https://court-admin.pages.dev"
echo "  Domain:   https://$APP_DOMAIN (configure DNS in Cloudflare dashboard)"
echo ""
echo "  Next: Set up Cloudflare Access application for your domain"
echo "        and update CF_ACCESS_AUD secret with the Application Audience tag."
echo ""
