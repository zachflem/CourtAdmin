#!/usr/bin/env bash
set -euo pipefail

# ── Helpers ───────────────────────────────────────────────────────────────────

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${BOLD}▶ $1${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
die()  { echo -e "\n${RED}✗ $1${NC}" >&2; exit 1; }

prompt_plain() {
  local label="$1"
  local value
  read -rp "$label: " value
  [[ -z "$value" ]] && die "$label cannot be empty."
  printf '%s' "$value"
}

prompt_secret() {
  local label="$1"
  local value
  read -rsp "$label: " value
  echo ""
  [[ -z "$value" ]] && die "$label cannot be empty."
  printf '%s' "$value"
}

# ── Banner ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       CourtAdmin — Fresh Deploy          ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Preflight ─────────────────────────────────────────────────────────────────

step "Preflight"
command -v npx &>/dev/null  || die "npx not found — install Node.js 18+ first."
npx wrangler --version &>/dev/null || die "wrangler not found — run: npm install"
ok "Node + wrangler available"

# ── Manual step reminder ───────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Before continuing, complete this manual step:${NC}"
echo "  1. Create a Cloudflare Access application for your app domain:"
echo "     Zero Trust → Access → Applications → Add → Self-hosted"
echo "     Identity provider: One-time PIN"
echo "     Policy: Allow / Everyone (or restrict to your email domain)"
echo "  2. Copy the Application Audience (AUD) tag from the app overview page."
echo ""
read -rp "Ready to continue? [y/N]: " READY
[[ "$READY" =~ ^[Yy]$ ]] || { echo "Exiting."; exit 0; }

# ── Credentials ───────────────────────────────────────────────────────────────

step "Credentials"
echo "(Secrets are used only to call wrangler — they are not stored in any file.)"
echo ""

CF_ACCOUNT_ID=$(prompt_plain   "Cloudflare Account ID")
CF_API_TOKEN=$(prompt_secret   "Cloudflare API Token (Workers + D1 + R2 permissions)")
CF_ACCESS_AUD=$(prompt_secret  "CF Access AUD tag (from Access application overview)")
RESEND_API_KEY=$(prompt_secret "Resend API key")
ADMIN_SEED_EMAIL=$(prompt_plain "Admin email address (auto-provisioned as admin on first login)")
APP_DOMAIN=$(prompt_plain      "App domain (e.g. court-admin.example.com)")
read -rp "Resend from-address [onboarding@resend.dev]: " RESEND_FROM_EMAIL
RESEND_FROM_EMAIL="${RESEND_FROM_EMAIL:-onboarding@resend.dev}"

# Export so wrangler picks them up automatically for all subsequent commands.
export CLOUDFLARE_API_TOKEN="$CF_API_TOKEN"
export CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID"

echo ""

# ── D1 Database ───────────────────────────────────────────────────────────────

step "D1 database"

DB_CREATE_OUT=$(npx wrangler d1 create court-admin-db 2>&1 || true)
DB_ID=$(echo "$DB_CREATE_OUT" \
  | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
  | head -1 || true)

if [[ -z "$DB_ID" ]]; then
  warn "Database may already exist — fetching existing ID..."
  DB_LIST_OUT=$(npx wrangler d1 list 2>&1)
  DB_ID=$(echo "$DB_LIST_OUT" \
    | grep "court-admin-db" \
    | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
    | head -1 || true)
fi

[[ -z "$DB_ID" ]] && die "Could not determine D1 database ID. Check wrangler output above."
ok "Database ID: $DB_ID"

# Patch wrangler.toml with the real database_id
sed -i "s/database_id = \"[^\"]*\"/database_id = \"$DB_ID\"/" wrangler.toml
ok "wrangler.toml → database_id updated"

# ── wrangler.toml vars ────────────────────────────────────────────────────────

step "wrangler.toml vars"

sed -i "s|FRONTEND_URL = \"[^\"]*\"|FRONTEND_URL = \"https://$APP_DOMAIN\"|" wrangler.toml
sed -i "s|RESEND_FROM_EMAIL = \"[^\"]*\"|RESEND_FROM_EMAIL = \"$RESEND_FROM_EMAIL\"|" wrangler.toml
ok "FRONTEND_URL    = https://$APP_DOMAIN"
ok "RESEND_FROM_EMAIL = $RESEND_FROM_EMAIL"

# ── D1 Migrations ─────────────────────────────────────────────────────────────

step "D1 migrations (remote)"
npx wrangler d1 migrations apply court-admin-db --remote
ok "Migrations applied"

# ── R2 Bucket ─────────────────────────────────────────────────────────────────

step "R2 bucket"
if npx wrangler r2 bucket create court-admin-assets 2>&1; then
  ok "Created court-admin-assets"
else
  warn "Bucket may already exist — continuing."
fi

# ── Worker Secrets ────────────────────────────────────────────────────────────

step "Worker secrets"
printf '%s\n' "$CF_ACCESS_AUD"    | npx wrangler secret put CF_ACCESS_AUD
printf '%s\n' "$RESEND_API_KEY"   | npx wrangler secret put RESEND_API_KEY
printf '%s\n' "$ADMIN_SEED_EMAIL" | npx wrangler secret put ADMIN_SEED_EMAIL
ok "CF_ACCESS_AUD, RESEND_API_KEY, ADMIN_SEED_EMAIL set"

# ── Build + Deploy ─────────────────────────────────────────────────────────────

step "Build and deploy"
npm run deploy
ok "Worker + frontend deployed"

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}✓ Deploy complete.${NC}"
echo ""
echo "  App URL: https://$APP_DOMAIN"
echo ""
echo "  Next steps:"
echo "  1. Add the custom domain in Cloudflare dashboard:"
echo "     Workers → court-admin → Settings → Domains & Routes → Add Custom Domain"
echo "     Point your DNS CNAME to <your-worker>.workers.dev"
echo "  2. Sign in at https://$APP_DOMAIN with ${ADMIN_SEED_EMAIL}."
echo "     Your account is auto-provisioned with admin role on first login."
echo "  3. Complete club setup in the Admin panel:"
echo "     Club Settings → name, logo, colors, contact info."
echo ""
