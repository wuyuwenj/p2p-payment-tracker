# Quick Start - Prisma Database Setup

## 🚀 5-Minute Setup

### 1. Create Supabase Account
Go to https://supabase.com → Sign up (free)

### 2. Create Project
- Name: `insurance-payment-tracker`
- Set strong database password (save it!)
- Choose region
- Click "Create"

### 3. Get Connection String
Settings → Database → Connection String → URI tab

Copy the URL and replace `[YOUR-PASSWORD]` with your actual password:
```
postgresql://postgres.[ref]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

### 4. Create `.env.local` File
In project root, create file `.env.local`:
```env
DATABASE_URL="paste_your_connection_string_here"
```

### 5. Setup Database
Run these commands:
```bash
cd insurance-payment-tracker
npx prisma generate
npx prisma db push
```

### 6. Restart App
```bash
# Stop with Ctrl+C
npm run dev
```

### 7. Test It!
1. Go to http://localhost:3000
2. Import Excel file
3. Check Supabase → Table Editor → See your data!

---

## ✅ Done!

You now have:
- ✅ Real PostgreSQL database
- ✅ Type-safe Prisma ORM
- ✅ Free cloud hosting (Supabase)
- ✅ Access from anywhere
- ✅ Automatic fallback to localStorage if database not configured

---

## 📚 Full Documentation

For detailed setup, troubleshooting, and advanced features:
- **Setup Guide**: `PRISMA_SETUP.md`
- **Database Schema**: `database-schema.md`
- **Features**: `FEATURES.md`

---

## 🆘 Common Issues

**"Environment variable not found"**
- Check `.env.local` exists in project root
- Restart terminal and app

**"Can't reach database"**
- Verify DATABASE_URL is correct
- Check password in connection string
- Ensure Supabase project is active

**Using localStorage fallback**
- DATABASE_URL not set correctly
- Check console for errors
- Restart app after adding `.env.local`

---

## 🎯 Next Steps

1. Import your insurance Excel data
2. Add Venmo payments
3. View reconciliation
4. Explore Prisma Studio: `npx prisma studio`
