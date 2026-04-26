# CourtAdmin — Development Roadmap

**Purpose:** Complete feature inventory and phased build order for the Cloudflare rebuild.
The original repo has been archived. This document is the single source of truth for the new build.

---

## Tech Stack — Old → New

| Concern | Old | New |
|---|---|---|
| API / Backend | Python FastAPI | Cloudflare Workers (TypeScript / Hono) |
| Database | MongoDB (Motor async driver) | Cloudflare D1 (SQLite via Wrangler) |
| File storage | Docker volume (local disk) | Cloudflare R2 |
| Email | SMTP (yagmail / smtplib), per-user config | Resend API (single key, no per-user SMTP) |
| Authentication | JWT + bcrypt, forgot-password token emails | Cloudflare Access — magic links via Resend |
| Frontend | React (CRA / craco) | React (Vite), hosted on Cloudflare Pages |
| Reverse proxy / routing | nginx | Cloudflare routing (Workers Routes + Pages) |
| Container runtime | Docker Compose | None — fully serverless |

---

## Roles

| Role | What they can do |
|---|---|
| `admin` | Everything. Platform config, user management, all content |
| `committee` | Seasons, teams, players, EOIs, feedback (all), email campaigns |
| `coach` | View assigned teams + players, create/view player feedback |
| `manager` | View assigned teams + players |
| `player` | View own profile, own teams, own feedback |
| `parent` | View own profile, children's feedback; linked to child player accounts |

---

## Full Feature Inventory

### 1. Infrastructure / Foundation

- Wrangler project structure (Workers + D1 + R2 bindings)
- D1 schema migrations (all tables with foreign keys)
- R2 bucket provisioning
- Cloudflare Pages project
- Environment secrets management (Resend key, CF Account ID, etc.)
- Deploy script — prompts for all required credentials, runs migrations, deploys Worker and Pages

---

### 2. Authentication (Cloudflare Access)

- Cloudflare Access policy gates the `/dashboard` route and all `/api/*` mutations
- Magic link flow: user enters email → Resend delivers the one-time link → CF Access issues a session JWT
- Worker reads `CF-Access-Authenticated-User-Email` header to identify the caller — no separate JWT needed
- First-access auto-provisioning: if a verified email has no user record in D1, create one with role `[]` (pending)
- Role-based authorization middleware in the Worker (checks `users.roles` for every protected endpoint)
- **Eliminated:** bcrypt passwords, JWT secret, forgot-password token table, forced first-login password change, admin-reset-password email with temp password, SMTP config for auth emails

---

### 3. Club Settings (Public Read)

- D1 table: `club_settings` (singleton row)
- Fields: `club_name`, `mission_statement`, `about_text`, `contact_phone`, `contact_email`, `contact_address`, `primary_color`, `secondary_color`, `accent_color`, `logo_url`, `hero_image_url`, `about_image_url`
- `GET /api/club-settings` — public, no auth
- Frontend `ClubProvider` context fetches settings on mount and makes them available app-wide (theme colors, branding)

---

### 4. Public Homepage

- **Hero section:** club name, mission statement, hero image (from R2), "Register Interest" CTA button
- **Features section:** static feature cards describing the club offering
- **About / Club Info section:** `about_text`, contact details, about image (from R2)
- **Homepage stats:** live counts from D1 — active players, teams, coaches + support staff (computed from active season)
- **Site-wide theming:** CSS variables driven by `primary_color` / `secondary_color` / `accent_color` from club settings
- Logo in navigation bar (from R2)
- Navigation: public links + Login button + "Register Interest" EOI trigger

---

### 5. Image Uploads — R2

Three asset slots, all admin-only:

- **Logo** — `POST /api/upload-logo`, `DELETE /api/delete-logo`
- **Hero image** — `POST /api/upload-hero-image`, `DELETE /api/delete-hero-image`
- **About image** — `POST /api/upload-about-image`, `DELETE /api/delete-about-image`

Each upload: validate extension (jpg/jpeg/png/gif/webp), max 10 MB, write to R2, store public URL in `club_settings`, delete previous object from R2.

---

### 6. Public EOI Form

Expression of Interest — submitted by anyone without an account.

**Form fields:**
- First name, last name, email, phone, date of birth
- Gender (Male / Female / Other)
- Grading level (1–5)
- Experience level
- Season interest (dropdown — only *open* seasons)
- Emergency contact name + phone
- Additional notes
- Clearance fields: `clearance_required` (bool), previous club name, previous team name, previous coach name
- Parent / guardian section — shown automatically when age calculated from DOB is under 18: parent name, email, phone, relationship to player

**Backend:**
- `GET /api/seasons/available` — returns only seasons where `is_closed = false`
- `POST /api/eoi` — inserts EOI record with `status = "pending"`, no auth required
- Age group is *not* stored at submission time — it is calculated at processing time against the active season's cutoff date

**Email (Resend):**
- Confirmation email to submitter on successful submission

---

### 7. Season Management

D1 table: `seasons`

Fields: `id`, `name`, `start_date`, `end_date`, `age_cutoff_date` (configurable, defaults to Jan 1 of season year), `is_active` (bool), `is_closed` (bool)

**Endpoints (committee / admin):**
- `GET /api/seasons` — all seasons
- `POST /api/seasons` — create
- `PUT /api/seasons/:id` — edit (name, dates, cutoff date, active/inactive, open/close toggle)
- `GET /api/seasons/available` — public; returns open + active seasons for EOI form dropdown

**UI:**
- Season list with create button
- Edit dialog: dates, cutoff date
- Open / Close toggle button per season
- Active / Inactive toggle per season

**Business logic:**
- `age_cutoff_date` is used by the age group calculation — players are graded by their age *as of* the cutoff date, not their age today
- Closing a season hides it from the public EOI form immediately

---

### 8. Team Management

D1 tables: `teams`, `team_players` (junction), `team_coaches` (junction), `team_managers` (junction)

`teams` fields: `id`, `name`, `season_id`, `age_group`

**Endpoints (committee / admin):**
- `GET /api/teams?season_id=` — list teams, optionally filtered by season
- `POST /api/teams` — create team
- `PUT /api/teams/:id` — update (name, age group, add/remove members)
- `GET /api/teams/by-age-group/:age_group` — used by EOI processing to suggest teams

**UI:**
- Season sidebar → team cards per season
- Create Team dialog
- Team Management dialog with three tabs: Players, Coaches, Managers
- Add / remove members from each role bucket
- Team card shows member counts

---

### 9. EOI Processing Workflow

This is the core admin workflow — turning a pending EOI into a player account.

**Endpoints:**
- `GET /api/eoi` — all EOIs (admin / committee)
- `PUT /api/eoi/:id` — approve or reject
- `GET /api/eoi/:id/calculated-age-group` — returns age group derived from DOB vs active season cutoff

**Approve flow (all in one transaction):**
1. Calculate age group from DOB vs active season `age_cutoff_date`
2. Admin selects jersey number (1–99) — system checks for conflicts across the target age group *and* adjacent age groups in the hierarchy (U8 → U10 → U12 → U14 → U16 → U18 → Senior)
3. Admin optionally assigns player to one or more age-appropriate teams
4. If no existing user with that email: create player account in `users` with `roles = ["player"]`
5. If player is under 18 and has `parent_guardian_email`: create or update parent account linked to this player
6. Set `first_year_registered` to today's date on the new user record
7. Store `assigned_teams`, `created_user_id`, `processed_by`, `processed_at` on the EOI record
8. Set EOI `status = "approved"`

**Reject flow:**
- Set `status = "rejected"`, store notes

**Email (Resend):**
- Welcome email to newly approved player (CF Access magic link invitation)
- Welcome email to newly created parent account

**UI:**
- Player Management panel with three tabs:
  - **Players** — sortable/searchable directory of all users with `player` role
  - **EOI Inbox** — pending applications with applicant summary cards
  - **Processed EOIs** — approved and rejected applications
- EOI Processing dialog:
  - Applicant details in vertical list layout
  - Calculated age group (computed live from API)
  - Jersey number dropdown (available numbers only, conflicts excluded)
  - Team selector filtered to matching age group
  - Approve / Reject buttons

---

### 10. User Management (Admin Only)

**Endpoints:**
- `GET /api/users` — all users
- `PUT /api/users/:id` — update user fields
- `PUT /api/users/:id/roles` — set roles array
- `GET /api/users/export` — CSV download
- `POST /api/users/import` — CSV upsert (match by email, skip password/id/created_at)
- `GET /api/role-requests` — pending role requests
- `PUT /api/role-requests/:id` — approve (merges roles) or reject
- `POST /api/auth/admin-invite` — sends CF Access magic link invitation via Resend

**Editable user fields:** first name, last name, phone, address, emergency contact, medical info, gender, grading level, first year registered, jersey number, clearance required, clearance status, previous club/team/coach, roles, is_active

**CSV export columns:** all user fields; roles pipe-delimited; instructions for generating UUIDs in Excel

**CSV import:** upsert by email; creates new users with pending role state; never overwrites id or created_at

**UI:**
- User list (searchable, sortable by name / role / status)
- User Details dialog — all fields editable
- Role Approval dialog — shows pending requests with requester info, current roles, duplicate detection
- Export / Import buttons

---

### 11. Role Request Workflow

Any authenticated user can request additional roles.

**Endpoints:**
- `POST /api/role-requests` — submit request (validates no duplicates with existing roles, no duplicate pending requests)
- `GET /api/role-requests` — pending only (admin / committee)
- `PUT /api/role-requests/:id?status=approved|rejected`

**UI (user-facing):**
- Role request form with justification text field
- Shows current pending requests

**UI (admin-facing):**
- Role Approval dialog: requester name, email, current roles, duplicate detection

---

### 12. Player Profile & Teams (Player / Parent View)

**Endpoints:**
- `GET /api/players/:id` — player profile (players see own only; coaches/committee see all)
- `PUT /api/players/:id` — update own profile

**My Profile fields (user-editable):** phone, address, emergency contact, medical info

**Read-only display:** name, email, jersey number, age group, grading level, clearance status, first year registered

**My Teams:** lists teams the authenticated user is a member of, with team name, season, age group, and roster tab view

---

### 13. Coach / Manager Views

- **Coach — My Teams:** teams where the coach is listed in `team_coaches`
- **Coach — My Players:** unique players across all coach's teams
- **Coach — Team Feedback:** create and view feedback for players on their teams
- **Manager — My Teams / My Players:** same as coach but read-only (no feedback creation)

---

### 14. Player Feedback System

D1 table: `player_feedback`

Fields: `id`, `player_id`, `coach_id`, `title`, `content`, `feedback_type` (technical / tactical / physical / mental / general), `rating` (1–5, optional), `created_at`, `updated_at`

**Endpoints:**
- `GET /api/players/:id/feedback` — role-based visibility: committee sees all; player sees own; parent sees children's; coach/manager sees all historical
- `POST /api/players/:id/feedback` — coach / committee only
- `GET /api/feedback` — all feedback (committee / admin)
- `GET /api/feedback/my-teams` — feedback for players on coach's teams

**UI:**
- **Coach:** Create Feedback dialog (player selector, type, rating, content); per-player feedback history
- **Player:** My Feedback tab — read-only list of received feedback
- **Committee:** All Feedback view — full table, filterable by player / coach / type
- **Parent:** children's feedback entries

---

### 15. Email Campaigns (Committee / Admin)

D1 tables: `email_templates`, `email_campaigns`

*Per-user SMTP config management is removed entirely. All outbound email uses the single Resend API key from Worker secrets.*

**Email Templates:**
- `GET/POST/PUT/DELETE /api/email-templates`

**Email Campaigns:**
- `GET/POST /api/email-campaigns` — compose + send: name, subject, HTML content, recipient list (by role group or individual), optional template
- Campaign record stores: `sent_count`, `failed_count`, `status`

**UI:**
- Email Composer tab (admin / committee)
- Recipient selector: by role or individual user search
- Template picker
- HTML content editor
- Send button with confirmation

---

### 16. Club Customization (Admin)

**Endpoint:** `PUT /api/club-settings` — admin only

**UI (ClubCustomizationSettings panel):**
- Club name, mission statement, about text
- Contact phone, email, address
- Primary / secondary / accent color pickers
- Logo, hero image, about image — upload (→ R2), preview, delete
- Live preview via `ClubProvider` context refresh

---

### 17. Deploy Script

`deploy.sh` prompts for all required credentials and stands up a fresh instance:

```
Prompts:
  - Cloudflare Account ID
  - Cloudflare API Token (Workers + D1 + R2 + Pages permissions)
  - Resend API Key
  - Admin email address (seeded as first admin user)
  - App domain / subdomain

Steps:
  - Validate wrangler is installed
  - Set wrangler secrets (RESEND_API_KEY, etc.)
  - Create D1 database if not exists
  - Run all D1 migrations
  - Create R2 bucket if not exists
  - Build frontend (npm run build)
  - Deploy Worker (wrangler deploy)
  - Deploy Pages (wrangler pages deploy ./frontend/dist)
  - Seed admin user record via D1 execute
  - Print app URL and next steps
```

---

## Stubs / Deferred Features

| Feature | Status in original | Plan |
|---|---|---|
| Coach Messaging | Stub component only | Defer to post-launch |
| Player Messages | Stub component only | Defer to post-launch |
| Contact Us / General Enquiry form | Listed as pending task | Defer to post-launch |

---

## D1 Schema Notes

Key differences from the original MongoDB design:

- Teams use three junction tables instead of embedded arrays (`team_players`, `team_coaches`, `team_managers`)
- `club_settings` is a single-row table (enforced in the Worker)
- `users.roles` stored as a JSON string column (`TEXT`, parsed in Worker)
- `eois.assigned_teams` stored as JSON string column
- All timestamps stored as ISO 8601 strings (`TEXT`)
- All IDs are UUIDs (`TEXT`)

---

## Build Phases

### Phase 0 — Scaffold & Infrastructure
- [x] Create new repo
- [x] `wrangler init` — Workers project with TypeScript
- [x] `wrangler.toml` — D1 binding (`DB`), R2 binding (`UPLOADS`), Workers Assets (`frontend/dist`)
- [x] Write all D1 migration SQL files (`users`, `club_settings`, `seasons`, `teams`, `team_players`, `team_coaches`, `team_managers`, `eois`, `player_feedback`, `email_templates`, `email_campaigns`, `role_requests`)
- [x] Create R2 bucket (`court-admin-assets`)
- [x] Vite + React scaffold → `frontend/`
- [x] Stub `deploy.sh` that can be run end-to-end (full implementation in Phase 15)

---

### Phase 1 — Auth & Identity
- [x] Configure Cloudflare Access application — Email OTP / Magic Link provider
- [x] Worker middleware: extract `CF-Access-Authenticated-User-Email`, look up `users` table, auto-provision on first access with `roles = []`
- [x] Role guard helper: `requireRole(ctx, ['admin'])` — returns 403 if not satisfied
- [x] `GET /api/auth/me` — returns current user record
- [x] Frontend `AuthProvider` context: calls `/api/auth/me` on load, stores user, redirects unauthenticated users to CF Access login
- [x] `ProtectedRoute` component

---

### Phase 2 — Club Settings + Homepage Shell
- [x] `GET /api/club-settings` (public)
- [x] `PUT /api/club-settings` (admin)
- [x] Frontend `ClubProvider` context
- [x] Navigation bar (logo, public links, Login button)
- [x] Hero section (club name, mission, hero image, CTA)
- [x] Features section (static cards)
- [x] About / Club Info section (about text, contact, about image)
- [x] Dynamic CSS variables from `primary_color` / `secondary_color` / `accent_color`
- [x] `GET /api/homepage-stats` (public)

---

### Phase 3 — Image Uploads (R2)
- [x] `POST /api/upload-logo`, `DELETE /api/delete-logo`
- [x] `POST /api/upload-hero-image`, `DELETE /api/delete-hero-image`
- [x] `POST /api/upload-about-image`, `DELETE /api/delete-about-image`
- [x] R2 put/delete via `env.UPLOADS.put()` / `.delete()`; store public URL in `club_settings`
- [x] Worker route to serve R2 objects: `GET /uploads/:category/:filename`
- [x] Frontend upload / preview / delete components (wired in Club Customization panel in Phase 14)

---

### Phase 4 — Season Management
- [x] `GET /api/seasons` (committee / admin)
- [x] `POST /api/seasons`
- [x] `PUT /api/seasons/:id` (edit, open/close toggle, active/inactive toggle)
- [x] `GET /api/seasons/available` (public — open + active only)
- [x] Frontend: Season list, Create Season dialog, Edit/toggle buttons

---

### Phase 5 — Public EOI Form
- [x] `POST /api/eoi` (public, no auth)
- [x] Frontend age calculation: show/hide parent fields based on DOB input
- [x] Season dropdown populated from `GET /api/seasons/available`
- [x] Resend: confirmation email to submitter on successful submission
- [x] Frontend: `EOIFormDialog` — full form with minor detection, clearance fields, parent section

---

### Phase 6 — Team Management
- [x] `GET /api/teams?season_id=`
- [x] `POST /api/teams`
- [x] `PUT /api/teams/:id` (add/remove players, coaches, managers via junction tables)
- [x] `GET /api/teams/by-age-group/:age_group`
- [x] `GET /api/teams/:id` (team with full member arrays — players, coaches, managers)
- [x] `GET /api/users` (minimal list for admin/committee — team member search; full UI in Phase 8)
- [x] Frontend: Team cards, Create Team dialog, Team Management dialog (3-tab roster)
- [x] NavBar: Seasons + Teams links shown for admin/committee roles

---

### Phase 7 — EOI Processing Workflow
- [x] `GET /api/eoi` (committee / admin)
- [x] `GET /api/eoi/:id/calculated-age-group`
- [x] `GET /api/players/available-jersey-numbers/:age_group`
- [x] `PUT /api/eoi/:id` — approve flow: create user, create parent if minor, assign to teams, set `first_year_registered`
- [x] `PUT /api/eoi/:id` — reject flow: set status + notes
- [x] Resend: welcome email (CF Access invitation) to approved player
- [x] Resend: welcome email to auto-created parent account
- [x] Frontend: EOI Inbox tab, EOI Processing dialog (age group, jersey picker, team selector), Processed EOIs tab

---

### Phase 8 — User Management (Admin)
- [x] `GET /api/users` — full user fields returned (admin/committee)
- [x] `PUT /api/users/:id` — update all editable user fields (admin only)
- [x] `PUT /api/users/:id/roles` — set roles array (admin only)
- [x] `GET /api/users/export` (CSV — roles pipe-delimited, admin only)
- [x] `POST /api/users/import` (CSV upsert by email, admin only)
- [x] Frontend: Players tab filled in (player-role directory, searchable, click to edit)
- [x] Frontend: All Users tab (admin only — all users, role filter, export/import buttons)
- [x] Frontend: UserDetailsDialog — all editable fields, roles checkboxes, status toggle

---

### Phase 9 — Role Request Workflow
- [ ] `POST /api/role-requests` (duplicate + pending check)
- [ ] `GET /api/role-requests` (pending only, committee / admin)
- [ ] `PUT /api/role-requests/:id` (approve merges roles; reject closes)
- [ ] Frontend: Role request form (user-facing), Role Approval dialog (admin-facing)

---

### Phase 10 — Player & Parent Dashboard
- [ ] `GET /api/players/:id`
- [ ] `PUT /api/players/:id` (own profile fields)
- [ ] My Teams endpoint (reads junction tables for current user)
- [ ] Frontend: My Profile tab, My Teams tab

---

### Phase 11 — Coach & Manager Dashboard
- [ ] `GET /api/coaches/:id/teams`
- [ ] `GET /api/coaches/:id/players`
- [ ] Frontend: Coach My Teams view, Coach My Players view

---

### Phase 12 — Player Feedback System
- [ ] `GET /api/players/:id/feedback` (role-based visibility)
- [ ] `POST /api/players/:id/feedback` (coach / committee)
- [ ] `GET /api/feedback` (committee — all)
- [ ] `GET /api/feedback/my-teams` (coach — own teams only)
- [ ] Frontend: Create Feedback dialog, Coach Feedback view, My Feedback tab (player), All Feedback view (committee), parent view of children's feedback

---

### Phase 13 — Email Campaigns
- [ ] `GET/POST/PUT/DELETE /api/email-templates`
- [ ] `GET/POST /api/email-campaigns`
- [ ] Campaign send: query recipients by role or ID list, batch via Resend
- [ ] Frontend: Email Composer tab (template picker, recipient selector, compose, send)

---

### Phase 14 — Club Customization UI
- [ ] Color pickers wired to `PUT /api/club-settings`
- [ ] Text content editors (club name, mission, about)
- [ ] Contact info fields
- [ ] Image management components (upload/preview/delete for all 3 asset slots, using Phase 3 endpoints)
- [ ] Live preview via `ClubProvider` context refresh

---

### Phase 15 — Deploy Script (Final Polish)
- [ ] Full `deploy.sh` implementation with credential prompts
- [ ] Wrangler secrets setup
- [ ] D1 database create + migrations
- [ ] R2 bucket create
- [ ] Frontend build + Worker deploy (`npm run deploy`)
- [ ] Admin user seed
- [ ] Post-deploy output: app URL, next steps
