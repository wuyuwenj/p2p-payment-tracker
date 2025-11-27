# Prisma + Supabase Setup Guide

This guide will help you set up **Prisma ORM** with **Supabase PostgreSQL** as your database backend.

## Why Prisma?

✅ **Type-Safe** - Full TypeScript support with autocomplete
✅ **Easy Migrations** - Automatic database schema updates
✅ **Great DX** - Best developer experience for databases
✅ **Works with Supabase** - Perfect combination with free PostgreSQL
✅ **No SQL Required** - Write queries in TypeScript

---

## Quick Start (15 minutes)

### Step 1: Create Supabase Project (5 minutes)

1. Go to **https://supabase.com**
2. Sign up (free, no credit card)
3. Click **"New Project"**
4. Fill in:
   - Name: `insurance-payment-tracker`
   - Database Password: **Create a strong password and SAVE IT!**
   - Region: Choose closest to you
   - Plan: **Free**
5. Click **"Create new project"**
6. Wait 1-2 minutes for setup

---

### Step 2: Get Database Connection String (2 minutes)

1. In Supabase dashboard, go to **Settings** (⚙️) → **Database**
2. Scroll to **Connection String** section
3. Select **URI** tab
4. You'll see something like:
   ```
   postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```
5. **Copy this connection string**
6. **Replace** `[YOUR-PASSWORD]` with your actual database password

---

### Step 3: Configure Environment Variables (2 minutes)

1. In your project root, create file `.env.local`
2. Add this line (replace with YOUR connection string):

```env
DATABASE_URL="postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
```

**IMPORTANT**:
- Replace `[YOUR-PASSWORD]` with actual password
- Keep the quotes around the URL
- Save the file

---

### Step 4: Generate Prisma Client (1 minute)

Run this command in your terminal:

```bash
cd insurance-payment-tracker
npx prisma generate
```

This creates the Prisma Client with TypeScript types for your models.

---

### Step 5: Create Database Tables (2 minutes)

Run this command to create the tables in Supabase:

```bash
npx prisma db push
```

You should see:
```
✔ Generated Prisma Client
🚀 Your database is now in sync with your Prisma schema.
```

**What this does:**
- Creates `insurance_payments` table
- Creates `venmo_payments` table
- Adds all indexes for fast queries
- Adds timestamps

---

### Step 6: Restart Your App (1 minute)

```bash
# Stop the server (Ctrl+C)
npm run dev
```

---

### Step 7: Test It! (2 minutes)

1. Open **http://localhost:3000**
2. Go to **Insurance Payments** page
3. Import an Excel file
4. Check Supabase dashboard:
   - Go to **Table Editor**
   - Click `insurance_payments`
   - See your data! 🎉

---

## ✅ Verification Checklist

- [ ] Supabase project created
- [ ] `.env.local` file created with DATABASE_URL
- [ ] Ran `npx prisma generate`
- [ ] Ran `npx prisma db push`
- [ ] App restarted
- [ ] Data appears in Supabase when imported
- [ ] Console shows "✅ Added X payments to database"

---

## 🎯 What You Get

### Type-Safe Database Queries

```typescript
// Before (localStorage)
const payments = JSON.parse(localStorage.getItem('payments'))

// After (Prisma) - Fully typed!
const payments = await prisma.insurancePayment.findMany()
//    ^? InsurancePayment[]
```

### Automatic Migrations

When you update `prisma/schema.prisma`:
```bash
npx prisma db push  # Updates database automatically
```

### Database Studio

View and edit data in a nice UI:
```bash
npx prisma studio
```
Opens **http://localhost:5555** with visual database editor!

---

## 📊 View Your Data

### Option 1: Supabase Dashboard
1. Go to **Table Editor** in Supabase
2. Select table
3. View, edit, filter data

### Option 2: Prisma Studio
```bash
npx prisma studio
```
- Better UI than Supabase
- Edit data visually
- See relationships

### Option 3: SQL Editor (Advanced)
In Supabase, go to **SQL Editor** and run:
```sql
SELECT * FROM insurance_payments;
SELECT * FROM venmo_payments;
```

---

## 🔄 Common Commands

### Generate Prisma Client
After changing `schema.prisma`:
```bash
npx prisma generate
```

### Push Schema to Database
After changing `schema.prisma`:
```bash
npx prisma db push
```

### Open Database Studio
Visual database editor:
```bash
npx prisma studio
```

### Pull Current Schema
If you made changes in Supabase directly:
```bash
npx prisma db pull
```

### Format Schema File
Clean up your `schema.prisma`:
```bash
npx prisma format
```

---

## 🚀 Advanced: Migrations (Production)

For production, use migrations instead of `db push`:

```bash
# Create migration
npx prisma migrate dev --name init

# Apply migrations in production
npx prisma migrate deploy
```

**Difference:**
- `db push` - Quick sync for development
- `migrate` - Tracked history for production

---

## 🔧 Troubleshooting

### "Environment variable not found: DATABASE_URL"

**Solution:**
1. Check `.env.local` exists in project root
2. Verify it has `DATABASE_URL="..."`
3. Restart terminal/dev server
4. Run `npx prisma generate` again

### "Can't reach database server"

**Solutions:**
1. Check DATABASE_URL is correct
2. Verify password in connection string
3. Check Supabase project is active (not paused)
4. Try connection pooler URL (port 6543) instead of direct (port 5432)

### "Using localStorage fallback"

**Cause:** DATABASE_URL not set or invalid

**Solution:**
1. Check console for exact error
2. Verify `.env.local` file
3. Restart app after changing env vars

### Tables not created

**Solution:**
```bash
npx prisma db push --force-reset
```
⚠️ Warning: This deletes all data!

### Type errors after schema changes

**Solution:**
```bash
npx prisma generate
```
Restart VS Code if types still don't update.

---

## 📁 File Structure

```
insurance-payment-tracker/
├── prisma/
│   └── schema.prisma          # Database schema definition
├── lib/
│   ├── prisma.ts              # Prisma client singleton
│   ├── prisma-storage.ts      # Database operations
│   └── types.ts               # TypeScript interfaces
├── .env.local                 # Your DATABASE_URL (gitignored)
└── .env.local.example         # Template for others
```

---

## 🎨 How It Works

### 1. Define Schema (prisma/schema.prisma)
```prisma
model InsurancePayment {
  id          String @id @default(uuid())
  payeeName   String
  amount      Decimal
}
```

### 2. Generate Client
```bash
npx prisma generate
```

### 3. Use in Code (Type-Safe!)
```typescript
import { prisma } from '@/lib/prisma'

// Create
await prisma.insurancePayment.create({
  data: { payeeName: "John", amount: 100 }
})

// Read
const payments = await prisma.insurancePayment.findMany()

// Update
await prisma.insurancePayment.update({
  where: { id: "..." },
  data: { amount: 200 }
})

// Delete
await prisma.insurancePayment.delete({
  where: { id: "..." }
})
```

All with **full TypeScript autocomplete**! ✨

---

## 🔐 Security

**Current Setup**: Direct database access
- Good for: Personal use, development
- Not for: Production with sensitive data

**To Secure**:
1. Enable Supabase Row Level Security (RLS)
2. Add authentication (Supabase Auth)
3. Use Supabase API instead of direct Prisma

See `DATABASE_MIGRATION_GUIDE.md` for authentication.

---

## 💾 Backup

### Automatic (Supabase)
- Daily backups on free tier
- 7-day retention

### Manual Export
```bash
# Export schema
npx prisma db pull

# Export data (requires pg_dump)
pg_dump $DATABASE_URL > backup.sql
```

### From Supabase Dashboard
1. **Table Editor** → Select table
2. Click **"•••"** → **"Download as CSV"**

---

## 📈 Monitor Usage

Supabase Dashboard → **Settings** → **Usage**

Free Tier Limits:
- ✅ 500 MB database
- ✅ 50,000 monthly active users
- ✅ 2 GB bandwidth
- ✅ Unlimited API requests

---

## 🎓 Learn More

- **Prisma Docs**: https://www.prisma.io/docs
- **Supabase Docs**: https://supabase.com/docs
- **Prisma + Next.js**: https://www.prisma.io/nextjs
- **Prisma Schema Reference**: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference

---

## 🆘 Need Help?

**Prisma Discord**: https://pris.ly/discord
**Supabase Discord**: https://discord.supabase.com
**Check Console**: Browser console shows detailed errors

---

## ✨ Next Steps

Once setup is complete:

1. ✅ **Test Import** - Import Excel data
2. ✅ **Add Venmo** - Record patient payments
3. ✅ **Check Reconciliation** - See balances
4. 🚀 **Deploy** - Use Vercel + Supabase
5. 👥 **Share** - Invite team members
6. 🔐 **Add Auth** - Secure with login

---

## 🎉 You're All Set!

Your app now uses:
- ✅ **Prisma** - Type-safe database ORM
- ✅ **PostgreSQL** - Powerful relational database
- ✅ **Supabase** - Free cloud hosting
- ✅ **Automatic Fallback** - Still works with localStorage if database isn't configured

Enjoy your fully-featured payment tracking system! 🚀
