# TaskFlow AI

AI-powered project & task management for small teams — a production-oriented full-stack
SaaS application built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS v4**,
**Drizzle ORM** and **SQLite/libSQL**.

The AI assistant is not a mock: it analyses your real projects, tasks, due dates and
activity to summarise progress, break briefs into tasks, re-rank priorities and surface
overdue or blocked work — and it works offline by default (no API key required).

```
┌───────────────────────────┐      ┌──────────────────────────────┐
│  Next.js App Router (UI)  │ ───▶ │  Server commands (Zod)       │ ──▶ Drizzle ORM ──▶ SQLite/libSQL
│  RSC pages + client views │      │  workspace-scoped access     │
└───────────────────────────┘      └──────────────────────────────┘
```

---

## 1. What was built

### Authentication
- **Sign up** (creates the user, their first workspace and an Owner membership in one transaction)
- **Log in** with scrypt-hashed passwords and database-backed sessions (httpOnly cookie, 30-day sliding expiry)
- **Log out** (server-side session revocation)
- **Forgot / reset password** — single-use, HMAC-hashed, 1-hour tokens; resetting revokes all other sessions
- **Protected dashboard** — edge middleware + per-request DB session validation; every workspace-scoped query is scoped to the signed-in user's workspace
- Login/sign-up/reset endpoints are rate limited; login timing does not reveal whether an account exists

### Dashboard
- Active projects, total tasks, completed tasks, overdue tasks (with week-over-week trend)
- 14-day completion vs creation chart, status breakdown, priority mix, team workload
- My tasks and upcoming deadlines, plus a workspace activity feed
- Greeting header with role and member count

### Projects
- Create, edit, archive/restore and delete (deletion is owner/admin only)
- Name, description, status (Planning / Active / On Hold / Completed / Archived), deadline, colour
- Live progress percentage from completed tasks, overdue counters, days-to-deadline
- Project members: add/remove teammates; removing a member unassigns their open tasks
- Filter by active/archived/all + search

### Tasks
- Create, edit, complete/reopen, delete
- Priority: Low / Medium / High / Urgent · Status: Todo / In Progress / Review / Done
- Due dates, assignee (validated to workspace members), project association
- Full-text search plus filters for project, status, priority, assignee (incl. “assigned to me” / “unassigned”), due window (overdue, today, next 7 days, no date), sorting and pagination
- Inline status dropdown and one-click complete in the table

### AI assistant (per project)
- **Summarise project** — progress narrative, signals and stats from real data
- **Break down a brief** — turns a paragraph or bullet list into atomic tasks with priorities and due-in-days estimates, then adds the selected ones to the project in one click
- **Suggest priorities** — risk-scored re-ranking of every open task, with per-task “Apply”
- **Find risks & blockers** — overdue, blocked, stalled, unassigned-soon, deadline and workload risks with severity
- **Status report** — a shareable markdown report (progress, risks, upcoming work, next actions)
- Provider-agnostic: `AI_PROVIDER=local` (deterministic engine, no key, no egress) or `AI_PROVIDER=openai` (any OpenAI-compatible endpoint) with automatic fallback to the local engine if the remote call fails. The API key is read server-side only.
- Runs are persisted per project (history + usage counter), rate limited per user

### Team
- Invite teammates with a single-use invite link (Owner/Admin only), copy the link, revoke it
- Member list with role, workload (open/done), join date
- Roles: **Owner** (one per workspace), **Admin**, **Member** — enforced in the command layer
- Remove members (owner and self-protection built in); invite acceptance requires the invited email

### Settings
- Profile: name, email, job title, timezone
- Password change (keeps the current session, signs out other devices)
- Notification preferences (due-date reminders, email, weekly digest, browser)
- Theme preference (light / dark / system) persisted per user and mirrored in `localStorage` for a flash-free load
- Workspace rename (admins) and workspace creation/switching

### UI
Responsive desktop/mobile layouts, sidebar + top navigation, dashboard cards, sortable
tables, modal forms, toast notifications, loading skeletons, empty states, error states,
light/dark themes, keyboard-accessible controls, skip-link, focus rings, `aria-*` wiring
and reduced-motion support.

---

## 2. How to run it

```bash
# 1. install dependencies
npm install

# 2. create your environment file
cp .env.example .env
#    → then set SESSION_SECRET to a long random value:
#      node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 3. create the database schema and load the demo workspace
npm run setup          # = drizzle-kit migrate + seed

# 4. start the dev server
npm run dev            # http://localhost:3000
```

Production:

```bash
npm run build && npm start
```

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run setup` | Apply migrations + seed demo data |
| `npm run db:migrate` | Apply pending migrations (`drizzle/*.sql`) |
| `npm run db:generate` | Generate a new migration from `src/db/schema.ts` |
| `npm run db:seed` | Load/refresh the demo workspace (idempotent) |
| `npm run db:reset` | Delete the SQLite file, re-migrate and re-seed |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run typecheck` / `lint` / `test` | TypeScript, ESLint, Vitest (47 tests) |
| `npm run verify` | typecheck + lint + tests + production build |

---

## 3. Required environment variables

Copy `.env.example` → `.env`. Only the first two are strictly required.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | ✅ | `file:./dev.db` | `file:` for local SQLite, `libsql://…`/`https://…` for Turso or any libSQL server |
| `SESSION_SECRET` | ✅ | — | 32+ random bytes. Signs session/reset tokens; rotating it invalidates sessions and invite links |
| `APP_URL` | — | `http://localhost:3000` | Used to build invite and password-reset links |
| `AI_PROVIDER` | — | `local` | `local` (built-in engine) or `openai` (OpenAI-compatible) |
| `OPENAI_API_KEY` | — | — | **Server-side only.** Never sent to the browser |
| `OPENAI_BASE_URL` | — | `https://api.openai.com/v1` | Works with Azure, Groq, Together, Ollama, LM Studio, … |
| `OPENAI_MODEL` | — | `gpt-4o-mini` | Any chat-completions model |
| `DATABASE_AUTH_TOKEN` | — | — | Required only for hosted libSQL/Turso |
| `DEMO_EMAIL` / `DEMO_PASSWORD` | — | `demo@taskflow.ai` / `Demo1234!` | Credentials created by the seed and pre-filled on the login screen |

Secrets are never imported into client components: `src/lib/env.ts` is server-only and the
AI provider reads the key inside `src/lib/ai/provider.ts` (server module).

---

## 4. Database setup & migrations

- **ORM:** Drizzle ORM with the libSQL driver (`src/db/index.ts`), schema in `src/db/schema.ts`
- **Migrations:** plain SQL in `drizzle/`, generated by `npm run db:generate` and applied by `npm run db:migrate`
- **Tables:** `users`, `sessions`, `password_reset_tokens`, `workspaces`, `memberships`, `invites`, `projects`, `project_members`, `tasks`, `activities`, `ai_runs`
- **Integrity:** foreign keys with `ON DELETE CASCADE` (e.g. deleting a workspace removes its projects, tasks and activity), unique indexes on emails, tokens and join tables, and indexes on every foreign key / filter column
- Timestamps are stored as integer milliseconds; enum-like columns are text validated in the app layer (`src/lib/constants.ts`, `src/lib/validation.ts`) so the same schema works on SQLite and Postgres

**Postgres / Turso in production**

1. Point `DATABASE_URL` at your database (add `DATABASE_AUTH_TOKEN` for Turso).
2. For Postgres, swap the driver in `src/db/index.ts` (`drizzle-orm/node-postgres` + `pg`) and adjust `dialect` in `drizzle.config.ts`; the query layer in `src/server/queries.ts` is written with portable Drizzle query builders (no SQLite-specific SQL).
3. Run `npm run db:migrate`.

### Demo data

`npm run db:seed` is idempotent and builds the **Northwind Studio** workspace:

- **5 members** — 1 Owner, 1 Admin, 3 Members (all with the demo password)
- **3 projects** — Website Redesign (active, due in 21 days), Mobile App v2.0 (active, due in 9 days), Q4 Marketing Campaign (planning)
- **20 tasks** — 9 Todo / 5 In Progress / 2 Review / 4 Done, spanning Low→Urgent, with **3 overdue**, one explicitly blocked, and 2 unassigned
- **14 activity entries** across the last 6 days
- **1 pending invitation** (Sara Owens) and **1 saved AI summary run**

---

## 5. Demo login credentials

| Email | Password | Role |
| --- | --- | --- |
| `demo@taskflow.ai` | `Demo1234!` | Owner (Alex Morgan) |
| `maya.chen@taskflow.ai` | `Demo1234!` | Admin (design lead) |
| `tom.reyes@taskflow.ai` | `Demo1234!` | Member (backend engineer) |
| `priya.nair@taskflow.ai` | `Demo1234!` | Member (product manager) |
| `leo.martin@taskflow.ai` | `Demo1234!` | Member (QA) |

The login screen pre-fills the demo account (values come from `DEMO_EMAIL` / `DEMO_PASSWORD`).
Logging in as a **Member** is the quickest way to see the permission boundaries: project and
task editing works, team management and workspace settings are read-only.

Things worth trying:

1. **Dashboard** → trend chart, overdue counter, workload and activity feed
2. **Projects → Website Redesign → AI assistant** → run *Summarise*, then *Find risks & blockers*
3. **AI assistant → Break down a brief** → paste a paragraph, generate tasks, click *Add selected*
4. **Tasks** → filter by `Overdue`, search, then use the inline status dropdown
5. **Team** → invite an address, copy the invite link, sign up as that address and open the link
6. **Settings → Appearance** → switch between light/dark/system

---

## 6. Architecture

```
src/
├─ app/
│  ├─ (auth)/                 # login, signup, forgot/reset password, invite acceptance
│  ├─ (app)/                  # authenticated shell: dashboard, projects, tasks, team, settings
│  ├─ api/actions/[name]/     # typed JSON command endpoint (one route, many commands)
│  ├─ layout.tsx              # theme bootstrap (no flash), toast provider, skip link
│  └─ error.tsx / not-found.tsx
├─ components/                # ui primitives (button, dialog, toast, …) + feature views
├─ db/                        # Drizzle schema, client singleton, seed script
├─ lib/                       # env, session, permissions, validation, password hashing,
│                             # tokens, rate limiting, AI engine + provider, utils
└─ server/
   ├─ commands.ts             # command registry (single source of truth)
   ├─ queries.ts              # read models (dashboard, projects, tasks, activity)
   ├─ action-utils.ts         # context resolution, parsing, error mapping
   └─ actions/                # auth, projects, tasks, team, settings, ai commands
```

**Why commands + a single JSON endpoint?** Every mutation is one exported function that
validates input with Zod, resolves the caller's workspace, performs the write inside a
transaction and returns a discriminated `ActionResult`. Those functions are consumed by
`POST /api/actions/<command>` (`src/app/api/actions/[name]/route.ts`), which means the same
logic is callable from client components, `curl`, tests and future services — and there is
exactly one place to audit for authorisation.

**Security posture**

- scrypt password hashing (OWASP parameters, per-user salt, constant-time comparison)
- Sessions: 256-bit random tokens, only an HMAC-SHA256 digest stored; httpOnly + SameSite=Lax cookie
- Every workspace-scoped command starts from `resolveWorkspaceContext()`; ids from the client are always re-validated against that workspace (verified: cross-tenant reads/writes return 404/403)
- Zod validation on every input, including “unknown enum” and “assignee must be a workspace member”
- Role checks: invite/remove/rename/delete require Owner or Admin; the last owner and yourself cannot be removed
- CSRF: cookie is `SameSite=Lax`, all mutations are POST-only JSON requests
- Rate limiting on login, sign-up, password reset, the assistant and the API endpoint as a whole
- No secret ever reaches the client bundle; errors are logged server-side and returned without internals

---

## 7. Testing

```bash
npm test        # Vitest — 47 unit tests
npm run verify  # typecheck + lint + tests + production build
```

Covered by tests: the AI engine (stats, risk detection, priority scoring, breakdown
clause extraction, report generation), validation schemas, password hashing/verification,
token hashing, rate limiting, role permissions and formatting utilities.

The API was also exercised end to end during development (auth, project/task CRUD,
archive/restore, team invites and role changes, settings, AI analyses, cross-tenant and
role-denied requests, password reset, invite acceptance, workspace switching).

---

## 8. Known limitations

1. **Email delivery is not wired up.** Invite links and password-reset links are generated
   server-side and written to the server log (and shown in the UI in development). Plug in
   Resend/SES/Nodemailer in `src/server/actions/team.ts` and `src/server/actions/auth.ts` to
   deliver them by email.
2. **Notification preferences are stored but not dispatched.** The toggles persist on the
   user record; a scheduled worker (due-date reminders, weekly digest) and a push provider
   would be the next step.
3. **Rate limiting is in-process.** Fine for a single Node instance; use Redis/Upstash for
   multi-instance or serverless deployments (the call sites only depend on `rateLimit()`).
4. **SQLite by default.** Great for a single-instance deployment and for demos; move to
   Turso/libSQL or Postgres for concurrent multi-region writes (see §4).
5. **Real-time collaboration is not implemented.** Data refreshes on navigation/`router.refresh()`;
   no websockets, no optimistic concurrency control (last write wins).
6. **Attachments, subtasks, comments, recurring tasks and calendar sync are out of scope.**
7. **The AI provider is advisory.** The local engine uses deterministic heuristics, and any
   remote model output is validated with Zod before it is rendered — but you should still
   review AI-created tasks (the UI requires you to select which ones to add).
8. **No automated end-to-end (browser) test suite** — the flows were verified manually and
   through HTTP-level checks. Playwright tests against the seeded workspace would be the
   natural next addition.
