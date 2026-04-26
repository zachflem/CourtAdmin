# CourtAdmin — Claude Rules

## Required Reading

Before starting any task, read these two documents in full:

- [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) — single source of truth for the build plan, feature inventory, phases, and current progress
- [DEPLOYMENT_DOCS.md](DEPLOYMENT_DOCS.md) — all manual and automatable steps to stand up a fresh instance

Both files must be kept accurate and up to date as work progresses.

---

## Keeping DEVELOPMENT_ROADMAP.md Up to Date

After completing any phase task or sub-task:

1. Mark the item `[x]` in the relevant **Build Phase** section.
2. If an entire phase is done, confirm all items in that phase are checked before moving on.
3. If a new feature, endpoint, table, or constraint is discovered or decided during implementation, add it to the **Full Feature Inventory** section under the appropriate heading.
4. If a phase's scope changes (tasks added, removed, reordered), update the corresponding phase block and leave a brief note in the commit message explaining the change.

Do **not** add items to the roadmap speculatively — only record things that are actually decided or built.

---

## Keeping DEPLOYMENT_DOCS.md Up to Date

Update this file immediately when any of the following change:

- A new secret or environment variable is required — add it to **Step 2** and the checklist.
- A new D1 migration is added — no file change needed (migrations are auto-tracked), but if the schema materially changes note it in context.
- A new R2 bucket or binding is added — update **Step 4** and `wrangler.toml` notes.
- The `FRONTEND_URL` or any `wrangler.toml` var changes — update **Step 8**.
- A new deploy step is identified — add it as a numbered step and a checklist item.
- The local dev workflow changes (new commands, new env vars, proxy changes) — update the **Local Development** section.
- The database ID or region changes — update the note in **Step 3**.

The checklist at the bottom of DEPLOYMENT_DOCS.md must always reflect the complete set of steps required for a fresh instance.

---

## Commit Discipline

- Commit after completing each phase (or a logical sub-unit of a phase if it is large).
- Commit message must be detailed: list every endpoint added, every migration created, every frontend component built, and every doc update made.
- Zach pushes to remote manually — never push unless explicitly asked.

---

## Project Context

| Item | Value |
|---|---|
| Runtime | Cloudflare Workers (TypeScript / Hono) |
| Database | Cloudflare D1 (SQLite) |
| File storage | Cloudflare R2 |
| Email | Resend API |
| Auth | Cloudflare Access — magic link / OTP |
| Frontend | React + Vite → Cloudflare Pages |
| Package manager | npm |
| Wrangler | project dev dependency (`npx wrangler`) |

Current D1 database ID: `33198368-5fdc-497d-bd78-2c480c08b566`

### Completed phases
- Phase 0 — Scaffold & Infrastructure
- Phase 1 — Auth & Identity
- Phase 2 — Club Settings + Homepage Shell
- Phase 3 — Image Uploads (R2)
- Phase 4 — Season Management
- Phase 5 — Public EOI Form
- Phase 6 — Team Management
- Phase 7 — EOI Processing Workflow
- Phase 8 — User Management (Admin)
- Phase 9 — Role Request Workflow
- Phase 10 — Player & Parent Dashboard
- Phase 11 — Coach & Manager Dashboard

### Next phase
- Phase 12 — Player Feedback System
