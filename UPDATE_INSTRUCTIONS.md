# MushaMumwe Update — New Departments

## Changes Made

### Removed Departments:
- ❌ Accounts
- ❌ Records

### Added Departments:
- ✅ **Procurement** — manage item requests, track tender status
- ✅ **Stores** — receive items, manage inventory
- ✅ **HR** — staff management, staffing levels

### Updated Features:
- ✅ New department login options in entry portal
- ✅ IT password allocation in their department login (no separate admin page)
- ✅ Nurses login kept as baseline
- ✅ Test users created for all departments
- ✅ Updated seed data with new departments

---

## How to Apply Updates

### Step 1: Replace Seed File
```bash
# Backup old seed file (optional)
cp prisma/seed.js prisma/seed.js.bak

# Copy new seed file
cp path/to/seed.js prisma/seed.js
```

### Step 2: Replace Entry Portal
```bash
# Copy new entry portal
cp path/to/entry.html public/entry.html
```

### Step 3: Regenerate Database
```bash
# Clear old database
rm -f dev.db dev.db-shm dev.db-wal

# Run new migration and seed
npm run prisma:generate
npx prisma migrate dev --name init
npm run seed
```

### Step 4: Start Server
```bash
npm run dev
```

---

## New Test Accounts

### Nurses Department
- `nurse1` / `nurse123`
- `nurse2` / `nurse123`

### IT Department (Admin)
- `it1` / `it123` ← Can create users and allocate passwords
- `it2` / `it123`

### Procurement Department
- `procurement1` / `proc123`
- `procurement2` / `proc123`

### Stores Department
- `stores1` / `store123`
- `stores2` / `store123`

### HR Department
- `hr1` / `hr123`
- `hr2` / `hr123`

---

## Quick Setup (All at Once)

```bash
cat > .env << 'EOF'
DATABASE_URL="file:./dev.db"
PORT=4000
JWT_SECRET="your-secret-key"
EOF

# Replace files
cp seed.js prisma/seed.js
cp entry.html public/entry.html

# Reset database and seed
rm -f dev.db dev.db-shm dev.db-wal
npm run prisma:generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

---

## Next Steps for Development

1. **Procurement Portal** — Add request submission and tender tracking
2. **Stores Portal** — Add inventory tracking and item receiving
3. **HR Portal** — Add staff roster and attendance tracking
4. **IT Dashboard** — Finalize password allocation feature
5. **Public Dashboard** — Update to show data from all departments

---

## Database Tables (No Changes)

All existing tables remain the same:
- User (updated with new departments)
- Patient
- Ward
- StatusLog

Department field now has values: `Nurses`, `IT`, `Procurement`, `Stores`, `HR`

---

Questions? Let me know!
