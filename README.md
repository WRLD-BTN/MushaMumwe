# MushaMumwe — Hospital Ward Status Dashboard

Real-time patient status board (admitted / in treatment / discharged / deceased)
running on the hospital LAN, backed by PostgreSQL.

## 1. Install

```bash
cd mushamumwe
npm install
cp .env.example .env
```

Edit `.env` with the hospital's real Postgres connection details, or your own
local Postgres if prototyping first.

## 2. Connect to the database

**If prototyping locally** (no hospital DB yet):
```bash
npx prisma migrate dev --name init
```
This creates fresh tables from `prisma/schema.prisma` in your local Postgres.

**If connecting to the hospital's existing database:**
```bash
npm run prisma:pull
```
This overwrites `prisma/schema.prisma` with their real table structure —
review it before generating the client, field names may differ from the
placeholder (e.g. `patient_status` instead of `status`).

Then either way:
```bash
npm run prisma:generate
```

## 3. Set up live sync

Run `sql/trigger.sql` against the database (via `psql` or a GUI like DBeaver/pgAdmin).
This makes Postgres broadcast a notification on every patient change — from
this app or their existing records system — which the server picks up and
pushes to all connected dashboards instantly.

## 4. Run the server

```bash
npm run dev
```

Server starts on `http://0.0.0.0:4000` — reachable from any device on the
same LAN via the server machine's local IP, e.g. `http://192.168.1.10:4000`.

## 5. Two separate pages — dashboard vs entry

- **`/` (index.html)** — the public/shared-screen board. Shows case ID,
  ward, status, and timestamp only. **No patient names, DOB, or national ID
  ever reach this page** — it reads from `/api/patients/board`, which the
  backend strips of PII at the query level, not just hidden in the UI.

- **`/entry.html`** — the department data-entry portal. This is where staff
  log in and actually register/update patients by name. Requires a JWT with
  `role: nurse | records_clerk | admin`.

Put the dashboard on a shared screen at the nurses' station; keep the entry
portal for staff devices only.

## Privacy design note

PII exclusion happens in three places, not just the frontend:
1. `GET /api/patients/board` — Prisma `select` explicitly omits name/dob/nationalId
2. `sql/trigger.sql` — the `pg_notify` payload is built manually with only id/status/wardId/updatedAt
3. `public/index.html` — never references `p.name`, only `p.id`

If you add more fields later, check all three spots before assuming they're excluded from the dashboard.

## Auth note

`src/auth.js` expects a JWT with a `role` claim (`nurse` / `admin`) and a
`username` claim, issued by whatever login flow you build. Until that
exists, you can generate a test token manually to try the write endpoint:

```js
const jwt = require("jsonwebtoken");
console.log(jwt.sign({ username: "test", role: "admin" }, "your_jwt_secret"));
```
Paste it into `localStorage.setItem("token", "...")` in the browser console
on the dashboard page.

## What's still needed for production

- A real login page/endpoint issuing JWTs (currently only middleware exists)
- Deploying on a machine with a static local IP
- Scheduled Postgres backups
- HTTPS if any device connects over Wi-Fi with other traffic on the same network

## Department logins

Staff no longer paste tokens — they log in with username/password at
`/entry.html`, and the server issues a JWT carrying their `department` and
`role`. Departments control what's visible:

- **nurses, records, it** — can register patients and update status
- **accounts** (and any other department) — read-only; entry form is hidden

To try it locally, seed test accounts:
```bash
node prisma/seed.js
```
This creates:

| username    | password    | department |
|-------------|-------------|------------|
| nurse1      | nurse123    | nurses     |
| records1    | records123  | records    |
| accounts1   | accounts123 | accounts   |
| it1         | it123       | it         |

Log in with `accounts1` to see the read-only view; log in with `nurse1` to
see the full entry form. Adjust `CAN_EDIT_DEPARTMENTS` in `entry.html` and
the `requireDepartment([...])` calls in `src/routes/patients.js` to match
the hospital's real department structure.
