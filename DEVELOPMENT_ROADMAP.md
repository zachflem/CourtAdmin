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

`teams` fields: `id`, `name`, `season_id`, `age_group`, `division`

> `division` is currently a free-text field populated from a hardcoded list (Div 1 / Div 2 / Div 3). A future Club Customization option will allow the admin to configure the divisions list.

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

### 17. Sponsor Management (Admin / Committee)

D1 table: `sponsors`

Fields: `id`, `name`, `tier` (gold / silver / bronze / general), `website_url`, `contact_name`, `contact_email`, `contact_phone`, `description`, `logo_small_url`, `logo_medium_url`, `logo_large_url`, `show_on_homepage`, `is_active`, `created_at`, `updated_at`

**Tier system:**
- **Gold** — permanent cards always visible on the homepage sponsors section
- **Silver / Bronze** — shown in a rotating carousel on the homepage
- **General** — not displayed on homepage

**Endpoints:**
- `GET /api/sponsors/public` — public, no auth; returns active `show_on_homepage = 1` sponsors ordered by tier
- `GET /api/sponsors` — all sponsors (admin / committee)
- `POST /api/sponsors` — create
- `GET /api/sponsors/:id` — detail
- `PUT /api/sponsors/:id` — full update
- `DELETE /api/sponsors/:id` — delete (cascades R2 logo cleanup)
- `POST /api/sponsors/:id/logo/:size` — upload logo (small / medium / large) to R2
- `DELETE /api/sponsors/:id/logo/:size` — remove logo from R2

**R2:** sponsor logos stored at `sponsor-logos/{sponsorId}/{size}/{filename}`, served via `/uploads/sponsor-logos/:sponsorId/:size/:filename`

**UI:**
- `/sponsors` page (admin / committee) — tier-filtered grid of sponsor cards
- Create Sponsor dialog: name, tier, website, contact info, description, show_on_homepage checkbox
- Manage Sponsor dialog with two tabs:
  - **Details** — all editable fields, active/inactive toggle, delete with confirmation
  - **Media Pack** — upload / preview / remove logo images for small, medium, and large sizes
- Homepage sponsors section: Gold row (permanent) + Silver/Bronze rotating carousel (3-second auto-advance), only shown when `show_on_homepage = 1` sponsors exist

---

### 18. Club Positions

D1 tables: `club_positions`, `user_positions` (junction)

`club_positions` fields: `id`, `name`, `display_order`, `created_at`

`user_positions` fields: `user_id`, `position_id`, `assigned_at`

**Endpoints:**
- `GET /api/club-positions` — list all (admin/committee)
- `POST /api/club-positions` — create (admin)
- `PUT /api/club-positions/:id` — rename (admin)
- `DELETE /api/club-positions/:id` — delete, cascades user_positions (admin)
- `PUT /api/users/:id/positions` — replace user's position assignments (admin)

**Data:** `GET /api/users` now includes `positions` array (`[{id, name}]`) per user via LEFT JOIN + GROUP_CONCAT.

**UI:**
- Club Settings page — Positions section: add/remove named positions
- User Management (UsersPage) — UserDetailsDialog shows Positions checkboxes (admin only)
- All Users table — Positions column shows assigned position badges

---

### 19. User Management Page + Navigation Restructure

Separated the previously overloaded `/players` page into three focused areas:

- **`/players`** — Players tab (player-role directory) + All Feedback tab
- **`/users`** (new) — All Users tab (admin only: CSV export/import) + Role Requests tab
- **`/email` (Messages)** — EOI Inbox tab + Processed EOIs tab added alongside Enquiries/Campaigns/Templates

NavBar updated: "Users" link added for admin/committee, sits alongside "Players" in the Manage section.

---

### 20. Grading System

D1 tables: `grading_sessions`, `grading_session_players`

`grading_sessions` fields: `id`, `season_id`, `name`, `age_group`, `gender` (Male / Female / Mixed), `status` (draft / committed), `notes`, `conducted_by`, `conducted_at`, `created_by`, `created_at`, `updated_at`

`grading_session_players` fields: `id`, `session_id`, `user_id`, `snapshot_name`, `snapshot_dob`, `snapshot_age_group`, `snapshot_gender`, `snapshot_grading_level`, `snapshot_previous_teams` (JSON), `new_grading_level`, `division_recommendation`, `coach_notes`, `entered_by`, `entered_at`

**Player Feedback change:** `feedback_context TEXT` column added to `player_feedback` — values: `game` / `grading` / `training` / `other` (nullable, independent of `feedback_type`)

**Workflow:** Paper-first or fully digital. Admin creates session → system auto-populates matching registered players (snapshotting current grade + previous teams) → bulk table editor for entering coach results → commit applies results: updates each player's `grading_level` profile field and creates a `player_feedback` record with `feedback_context = 'grading'`.

**Endpoints (admin / committee):**
- `GET /api/grading-sessions` — list with player count
- `POST /api/grading-sessions` — create + auto-populate players
- `GET /api/grading-sessions/:id` — detail with players list
- `PUT /api/grading-sessions/:id` — update metadata
- `DELETE /api/grading-sessions/:id` — delete draft only
- `PUT /api/grading-sessions/:id/players` — bulk upsert coach results (auto-saved per row)
- `POST /api/grading-sessions/:id/commit` — apply: update profiles + create feedback records
- `GET /api/grading-sessions/:id/print` — printable HTML roster (server-side fallback)

**UI:**
- Grading Sessions tab on `/players` page (admin / committee)
- Session list table with create dialog
- Session detail view: bulk table editor (tablet-friendly, auto-save on blur)
- Print Roster button → opens `/grading/:id/print` (React print page, landscape A4)
- Commit Results button → confirmation → locked read-only session
- `feedback_context` (Game / Grading / Training / Other) added as second dimension on all feedback UI (CreateFeedbackDialog, FeedbackCard, AllFeedbackTab filter)

---

### 21. Deploy Script

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

### 22. Team Schedule & Play Day

Addition to the existing `teams` table and team card UI.

- `play_day` column added to `teams` — day of week the team's association games are played (e.g. "Thursday")
- Displayed as a badge on the team card
- Editable in the Create / Edit Team dialog (day-of-week dropdown)
- Training schedule already derived from `venue_timeslots` + `team_timeslot_assignments` (built in Phase 16) — surfaced more prominently on the team card
- When a team has **no training timeslot assigned**, the team card shows available (unassigned) timeslots across all venues as suggestion pills — prompting admin/committee to assign one, or giving coaches/managers visibility to request one via internal messaging

---

### 23. Document Management

D1 tables: `documents`, `document_acknowledgements`

`documents` fields: `id`, `title`, `category`, `description`, `file_url`, `file_name`, `requires_acknowledgement` (bool), `is_public` (bool), `version`, `created_by`, `created_at`, `updated_at`

`document_acknowledgements` fields: `id`, `document_id`, `user_id`, `acknowledged_at`

**Endpoints:**
- `GET /api/documents/public` — public; no auth; returns `is_public = true` docs
- `GET /api/documents` — authenticated; admin/committee see all; members see member-visible docs
- `POST /api/documents` — upload file to R2 + create record (admin / committee)
- `PUT /api/documents/:id` — update metadata, optionally replace file (admin / committee)
- `DELETE /api/documents/:id` — delete record + R2 cleanup (admin / committee)
- `POST /api/documents/:id/acknowledge` — authenticated user records acknowledgement
- `GET /api/documents/:id/acknowledgements` — who has / hasn't acknowledged (admin / committee)

**UI:**
- `/documents` page — admin/committee management view (upload, edit, delete, view acknowledgement status)
- Member view: document list with "I have read and acknowledge" button on required docs
- Acknowledgement status table per document: who has signed, who hasn't

---

### 24. Notification Badges & Toasts

No new D1 tables — badge counts derived from existing data.

**New endpoint:**
- `GET /api/notifications/summary` — returns counts of pending items: `pending_eois`, `pending_role_requests`, `unread_messages`, `pending_acknowledgements`

**UI:**
- Numeric badge overlays on relevant nav items (e.g. EOI count on Messages link, role requests count on Users link)
- Single non-blocking toast on page load (once per session via `sessionStorage`): summarises any count > 0
- Toast is dismissible, appears in top-right corner, does not auto-redirect
- No polling — summary endpoint called once on authenticated page load

---

### 25. Internal Messaging

Direct threaded messaging between club members — primarily for coaches/managers to contact committee members by role or position (e.g. "Venue Coordinator", "Coaching Coordinator").

D1 tables: `message_threads`, `message_thread_members`, `messages`, `message_thread_reads`

`message_threads` fields: `id`, `subject`, `created_by`, `created_at`

`message_thread_members` fields: `thread_id`, `user_id` — participants expanded from role/position at thread creation time

`messages` fields: `id`, `thread_id`, `sender_id`, `body`, `created_at`

`message_thread_reads` fields: `thread_id`, `user_id`, `last_read_at`

**Recipient addressing:** when composing, sender selects recipients by individual user, role (e.g. `committee`), or club position (e.g. "Venue Coordinator"). System resolves to a list of matching user IDs and stores them in `message_thread_members`. New users who later acquire the role/position do not auto-join existing threads.

**Endpoints:**
- `GET /api/messages/threads` — threads the current user is a member of, with unread count
- `POST /api/messages/threads` — create thread (subject + body + recipient list, resolved server-side)
- `GET /api/messages/threads/:id` — full thread with all messages
- `POST /api/messages/threads/:id` — reply to thread
- `PUT /api/messages/threads/:id/read` — mark thread read (updates `message_thread_reads`)
- `GET /api/messages/unread-count` — total unread thread count for current user (used by notification badge)

**UI:**
- Inbox tab on the Messages page — thread list, unread highlighted, click to open thread view
- Compose dialog: subject, recipient picker (search by name / filter by role or position), message body
- Thread view: message history + reply box
- Unread count badge on Messages nav link (feeds into the Phase 21 notification summary)

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
- [x] `POST /api/role-requests` (duplicate + pending check)
- [x] `GET /api/role-requests` (pending only, committee / admin)
- [x] `PUT /api/role-requests/:id` (approve merges roles; reject closes)
- [x] Frontend: Role request form (user-facing), Role Approval dialog (admin-facing)

---

### Phase 10 — Player & Parent Dashboard
- [x] `GET /api/players/:id`
- [x] `PUT /api/players/:id` (own profile fields)
- [x] My Teams endpoint (reads junction tables for current user)
- [x] Frontend: My Profile tab, My Teams tab

---

### Phase 11 — Coach & Manager Dashboard
- [x] `GET /api/coaches/:id/teams`
- [x] `GET /api/coaches/:id/players`
- [x] `GET /api/managers/:id/teams`
- [x] `GET /api/managers/:id/players`
- [x] Frontend: Coach My Teams view, Coach My Players view
- [x] Frontend: Manager My Teams view, Manager My Players view

---

### Phase 12 — Player Feedback System
- [x] `GET /api/players/:id/feedback` (role-based visibility)
- [x] `POST /api/players/:id/feedback` (coach / committee)
- [x] `GET /api/feedback` (committee — all)
- [x] `GET /api/feedback/my-teams` (coach — own teams only)
- [x] `GET /api/parents/:id/children` — player accounts linked to a parent via approved EOIs
- [x] Frontend: Create Feedback dialog, Coach Feedback view, My Feedback tab (player), All Feedback view (committee), parent view of children's feedback

---

### Phase 13 — Email Campaigns
- [x] `GET/POST/PUT/DELETE /api/email-templates`
- [x] `GET/POST /api/email-campaigns`
- [x] Campaign send: query recipients by role or ID list, batch via Resend
- [x] Frontend: Email Composer tab (template picker, recipient selector, compose, send)

---

### Phase 14 — Club Customization UI
- [x] Color pickers wired to `PUT /api/club-settings`
- [x] Text content editors (club name, mission, about)
- [x] Contact info fields
- [x] Image management components (upload/preview/delete for all 3 asset slots, using Phase 3 endpoints)
- [x] Live preview via `ClubProvider` context refresh

---

### Phase 15 — Deploy Script (Final Polish)
- [x] Full `deploy.sh` implementation with credential prompts
- [x] Wrangler secrets setup
- [x] D1 database create + migrations
- [x] R2 bucket create
- [x] Frontend build + Worker deploy (`npm run deploy`)
- [x] Admin user seed (via ADMIN_SEED_EMAIL secret — auto-provisioned on first login)
- [x] Post-deploy output: app URL, next steps

---

### Phase 16 — Venue Management
- [x] Migration `0010_venues.sql` — `venues`, `venue_timeslots`, `venue_access`, `venue_documents`, `team_timeslot_assignments` tables
- [x] `GET /api/venues` (admin / committee / coach / manager — returns venues with timeslots + counts)
- [x] `GET /api/venues/:id` (admin / committee — full detail with timeslots + assigned teams, access, documents)
- [x] `POST /api/venues` (admin / committee)
- [x] `PUT /api/venues/:id` (admin / committee)
- [x] `DELETE /api/venues/:id` (admin / committee — cascades R2 doc cleanup)
- [x] `POST /api/venues/:id/timeslots` — add a weekly timeslot
- [x] `DELETE /api/venues/:id/timeslots/:timeslotId`
- [x] `POST /api/venues/:id/access` — grant user access (key / card / code / other)
- [x] `DELETE /api/venues/:id/access/:userId`
- [x] `POST /api/venues/:id/documents` — upload doc to R2 (`venue-docs/{venueId}/…`)
- [x] `DELETE /api/venues/:id/documents/:docId`
- [x] `PUT /api/teams/:id` extended — `add_timeslots` / `remove_timeslots` arrays
- [x] `GET /api/coaches/:id/teams` + `GET /api/managers/:id/teams` — include `training` array
- [x] `/uploads/venue-docs/:venueId/:filename` serving route (3-level R2 path)
- [x] Frontend: `/venues` page — venue cards grid, Create Venue dialog, Manage dialog (5 tabs: Details, Timeslots, Access, Documents, Assigned Teams)
- [x] Timeslots tab — team assignment UI (assign / unassign team per slot)
- [x] Coach / manager: Venues link in NavBar; read-only venue list on `/venues`
- [x] Coach / manager dashboard — training venue section on each team card (venue name, address, schedule chips)

---

### Phase 17 — Sponsor Management
- [x] Migration `0011_sponsors.sql` — `sponsors` table
- [x] `GET /api/sponsors/public` — public endpoint (no auth), ordered by tier
- [x] `GET /api/sponsors` (admin / committee)
- [x] `POST /api/sponsors` (admin / committee)
- [x] `GET /api/sponsors/:id` (admin / committee)
- [x] `PUT /api/sponsors/:id` — full update (admin / committee)
- [x] `DELETE /api/sponsors/:id` — cascades R2 logo cleanup (admin / committee)
- [x] `POST /api/sponsors/:id/logo/:size` — upload logo to R2 (small / medium / large)
- [x] `DELETE /api/sponsors/:id/logo/:size` — remove logo from R2
- [x] R2 serving route: `/uploads/sponsor-logos/:sponsorId/:size/:filename` (4-level path)
- [x] Frontend: `/sponsors` page — tier-filter bar, sponsor card grid
- [x] Create Sponsor dialog
- [x] Manage Sponsor dialog — Details tab (edit + delete) and Media Pack tab (upload/preview/remove per size)
- [x] NavBar: Sponsors link for admin / committee
- [x] Homepage sponsors section: Gold permanent row + Silver/Bronze auto-rotating carousel
- [x] `DEVELOPMENT_ROADMAP.md` updated

---

### Phase 18 — Grading System
- [x] Migration `0017_grading.sql` — `grading_sessions`, `grading_session_players` tables
- [x] Migration `0018_feedback_context.sql` — add `feedback_context` column to `player_feedback`
- [x] `GET /api/grading-sessions` (admin / committee)
- [x] `POST /api/grading-sessions` — create + auto-populate registered players
- [x] `GET /api/grading-sessions/:id` — detail with players list
- [x] `PUT /api/grading-sessions/:id` — update session metadata
- [x] `DELETE /api/grading-sessions/:id` — draft sessions only
- [x] `PUT /api/grading-sessions/:id/players` — bulk upsert grading results
- [x] `POST /api/grading-sessions/:id/commit` — apply: update `users.grading_level` + create `player_feedback` records
- [x] `GET /api/grading-sessions/:id/print` — server-side printable HTML roster
- [x] `POST /api/players/:id/feedback` — accepts optional `feedback_context` field
- [x] Frontend: Grading Sessions tab on `/players` (session list + create dialog)
- [x] Frontend: Session detail bulk editor (tablet-friendly, auto-save per row on blur)
- [x] Frontend: Commit Results confirmation dialog
- [x] Frontend: `/grading/:id/print` — React print page (A4 landscape, print CSS)
- [x] Frontend: `feedback_context` (Game / Grading / Training / Other) added to `CreateFeedbackDialog`
- [x] Frontend: context badge added to `FeedbackCard` and `AllFeedbackTab` (with context filter)
- [x] `DEVELOPMENT_ROADMAP.md` updated

---

### Phase 19 — Team Schedule & Play Day
- [x] Migration — add `play_day` column to `teams`
- [x] `PUT /api/teams/:id` — accept and persist `play_day`
- [x] `GET /api/teams` — include `play_day` and `training_count` in response
- [x] `GET /api/venues/available-timeslots` — returns unassigned timeslots across all venues (admin / committee / coach / manager)
- [x] Frontend: Create / Edit Team dialog — day-of-week dropdown for play day
- [x] Frontend: Team card — show play day badge alongside age group and division
- [x] Frontend: Team card — when no training timeslot is assigned, show available unassigned slots as suggestion pills
- [x] `DEVELOPMENT_ROADMAP.md` updated

---

### Phase 20 — Document Management
- [x] Migration `0020_documents.sql` — `documents` + `document_acknowledgements` tables
- [x] `GET /api/documents/public` (no auth — inline in index.ts)
- [x] `GET /api/documents` (authenticated; all authenticated users; includes `user_has_acknowledged` per doc)
- [x] `POST /api/documents` — R2 upload + record create (admin / committee)
- [x] `PUT /api/documents/:id` — update metadata / replace file (admin / committee)
- [x] `DELETE /api/documents/:id` — record + R2 cleanup (admin / committee)
- [x] `POST /api/documents/:id/acknowledge` (authenticated user; upsert — idempotent)
- [x] `GET /api/documents/:id/acknowledgements` (admin / committee — acknowledged + not-yet-acknowledged lists)
- [x] R2 serving route: `/uploads/documents/:docId/:filename` (3-level, before generic 2-level route)
- [x] Frontend: `/documents` page — admin/committee management view (upload, edit, delete)
- [x] Frontend: member document list with acknowledge button on required docs; green badge when done
- [x] Frontend: acknowledgement status table per document in ManageDocumentDialog (admin/committee)
- [x] NavBar: Documents link for staff (admin/committee) and coach/manager menus
- [x] `DEVELOPMENT_ROADMAP.md` updated

---

### Phase 21 — Notification Badges & Toasts
- [ ] `GET /api/notifications/summary` — returns counts: pending EOIs, pending role requests, unread contact messages, pending document acknowledgements
- [ ] Frontend: badge overlays on relevant nav items (role-aware — only show counts relevant to the current user's roles)
- [ ] Frontend: session toast on authenticated page load — summarises non-zero counts, dismissible, non-blocking
- [ ] `sessionStorage` flag to suppress toast after first dismiss within a session
- [ ] `DEVELOPMENT_ROADMAP.md` updated

---

### Phase 22 — Internal Messaging
- [ ] Migration — `message_threads`, `message_thread_members`, `messages`, `message_thread_reads` tables
- [ ] `GET /api/messages/threads` — thread list with unread count per thread
- [ ] `POST /api/messages/threads` — create thread; resolve role/position recipients to user IDs server-side
- [ ] `GET /api/messages/threads/:id` — full thread with messages
- [ ] `POST /api/messages/threads/:id` — reply
- [ ] `PUT /api/messages/threads/:id/read` — mark read
- [ ] `GET /api/messages/unread-count` — total unread for current user (used by notification badge)
- [ ] Frontend: Inbox tab on Messages page — thread list, unread highlighting
- [ ] Frontend: Compose dialog — subject, recipient picker (by name / role / position), body
- [ ] Frontend: Thread view — message history + reply box
- [ ] Frontend: unread badge wired to Messages nav link; feeds into notification summary
- [ ] `DEVELOPMENT_ROADMAP.md` updated

---

### Bugs & Fixes
- [x] rename frontend app - match 'Club Name', defaults to 'CourtAdmin' if the name isn't set.
- [x] about and contact are homepage sections (id="about" / id="contact"); navbar links to anchors; content managed via existing Club Settings fields.
- [x] contact form on homepage: name, email, enquiry type, message; stores to contact_messages table; forwards copy via Resend to per-type email (fallback: club contact_email); admin/committee inbox on Messages page; enquiry types configurable in Club Settings.
- [x] homepage restructured: Features section removed; About and Contact are now separate sections; /platform page added (sells CourtAdmin platform, uses club colour scheme + logo.png, linked from footer as "Powered by CourtAdmin").
- [x] add new icon.  favicon.png + logo.png placed in frontend/public/; favicon wired in index.html; logo shown in navbar; document.title updates from club_name via ClubContext.
- [x] move seasons from a dedicated page, to the Seasons select sidebar of the Teams page.  it makes sense to add and edit seasons from here, rather than having a whole page dedicated to what is a pretty simple function.   We should always float active seasons to the top of the sidebar, and inactive seasons should be in chronological order below a seperator in the sidebar.  Show an edit icon on each season to bring up the edit season modal, and a [+ New Season] button in the sidebar header to add a new season.
- [x] expand the existing role based auth to add specific committee role tagging.  some way to identify specific duties within the system.  these should be user defined and configurable on the settings page.  roles like [President] [Treasurer] [Coaching Coordinator] etc.
- [x] revise the Division mechanic from Phase 8 - currently it's a hard coded list, I want to make it a dynamic list like Age Groups is now.
- [x] we've currently got Player Management containing user management, EOIs and feedback.  I think we should move EOIs into the messaging page, this fits a bit better in there.  All users and Role requests should be either their own page.
- [x] add a grading system.  not to automate the grading process, but to provide a mechanism for grading an age group of players.  Export a PDF with all the players registered for the upcoming season, filter by age and gender, show previous teams and grading levels, and provide space for coaches to make notes and a new grading determination.  once complete, we provide a mechanism for updating the info.  Coaches aren't going to carry around a laptop, it's much more likely to be a clipboard.  So we should cater to that kind of data gathering.
- [x] the user bulk import didn't send the welcome email, and ignored Jersy #, Date of Birth, Age Group from the CSV.
- [x] The edit user modal has the heading and subheading (users email) overlapped
- [x] investigate any way to speed up the loading process?  there is a flash of the default colours that pops up as the page loads
- [x] rename the 'General' tier of sponser to "Supporter" across the platform
- [x] venues might have more than one court available.  timeslots should include the court name/number.  group timeslots by name/number when listing.
- [x] the venues page lines up all the venues vertically.  this might be fine on mobile, but we should use more of the screen realestate on desktop.
- [x] on the venues page, we list the available slots on the card, but only show the number of teams as a summary.  let's show: timeslots without teams assigned as an orange pill (because we want to warn that a booked slot isn't utilised) and timeslots with teams assigned as a green pill, and show the team name in the pill as well.  Stack timeslots vertically on the venue card.
- [ ] investigate adding an instagram carousel to the homepage.  set the url and grab the last N posts
- [ ] investigate intergrated email inbox: Implement a shared inbox by configuring inbound email handling (via Resend webhooks) so emails sent to club@domain.com are ingested into your application as conversations. Store each message with a unique thread ID and allow users to assign conversations to roles (e.g., President, Coaching Coordinator) within your existing permission system. When sending replies, use a clean From address but include a Reply-To with a thread-specific plus address (e.g., club+thread_abc123@domain.com) so incoming replies can be automatically matched back to the correct conversation. Use email headers (Message-ID, In-Reply-To) as a fallback for reliable threading, and persist assignment/state in your database rather than relying solely on email routing.
