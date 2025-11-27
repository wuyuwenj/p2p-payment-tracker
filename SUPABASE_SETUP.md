# Supabase Setup Guide

This guide will help you set up Supabase as the database backend for the Insurance Payment Tracker.

## Why Supabase?

✅ **Free tier** - No credit card required
✅ **PostgreSQL** - Powerful relational database
✅ **Real-time** - Auto-updates across devices
✅ **No server management** - Fully hosted
✅ **Easy backup** - Built-in database backups

---

## Step 1: Create Supabase Account (5 minutes)

1. Go to https://supabase.com
2. Click **"Start your project"**
3. Sign up with GitHub, Google, or Email
4. Verify your email

---

## Step 2: Create a New Project (2 minutes)

1. Click **"New Project"**
2. Fill in:
   - **Name**: `insurance-payment-tracker` (or your choice)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you (e.g., US East, Europe West)
   - **Pricing Plan**: Free
3. Click **"Create new project"**
4. Wait 1-2 minutes for project to initialize

---

## Step 3: Run Database Schema (3 minutes)

1. In your Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Open the file `supabase-schema.sql` in your project folder
4. **Copy ALL the SQL** from that file
5. **Paste** into the Supabase SQL editor
6. Click **"Run"** (or press Ctrl+Enter)
7. You should see: "Success. No rows returned"

This creates your two tables:
- `insurance_payments`
- `venmo_payments`

---

## Step 4: Get Your API Credentials (2 minutes)

1. In Supabase dashboard, click **Settings** (⚙️ icon in left sidebar)
2. Click **API** in the settings menu
3. Find these two values:

   **Project URL**:
   ```
   https://xxxxxxxxxxxxx.supabase.co
   ```

   **anon/public key** (under "Project API keys"):
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **Keep this tab open** - you'll need these values next

---

## Step 5: Configure Your App (3 minutes)

1. In your project folder, create a file named `.env.local`
2. Add the following (replace with YOUR values):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Save the file

**IMPORTANT**:
- Make sure the file is named exactly `.env.local`
- Replace the values with YOUR actual credentials from Step 4
- Never commit this file to git (it's already in .gitignore)

---

## Step 6: Restart Your App (1 minute)

1. Stop the development server (Ctrl+C in terminal)
2. Start it again:
   ```bash
   npm run dev
   ```

3. Open http://localhost:3000

---

## Step 7: Test the Database Connection

1. Go to **Insurance Payments** page
2. Import an Excel file
3. Check your Supabase dashboard:
   - Click **Table Editor** (left sidebar)
   - Click `insurance_payments` table
   - You should see your imported data!

4. Go to **Venmo Payments** page
5. Add a payment
6. Check Supabase → `venmo_payments` table
7. Data should appear there too!

---

## ✅ Verification Checklist

- [ ] Supabase project created
- [ ] SQL schema executed successfully
- [ ] `.env.local` file created with correct credentials
- [ ] App restarted
- [ ] Data appears in Supabase when imported
- [ ] Data persists after page refresh
- [ ] Data accessible from different browsers/devices

---

## 🎉 You're Done!

Your app now uses a real database instead of localStorage!

**Benefits you now have:**
- ✅ Data persists permanently
- ✅ Access from any device/browser
- ✅ Can share with team members
- ✅ Automatic backups
- ✅ Better performance with large datasets

---

## 🔧 Troubleshooting

### "Using localStorage fallback" message

**Problem**: App is still using localStorage instead of database

**Solutions**:
1. Check `.env.local` file exists in project root
2. Verify variable names are EXACTLY:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Restart the dev server (Ctrl+C then `npm run dev`)
4. Check browser console for errors

### "Error fetching insurance payments"

**Problem**: Can't connect to Supabase

**Solutions**:
1. Verify Project URL is correct
2. Verify API key is correct (copy/paste carefully)
3. Check Supabase project is running (not paused)
4. Check internet connection

### No data showing after import

**Problem**: Data not being saved to database

**Solutions**:
1. Check browser console for errors
2. Go to Supabase → SQL Editor → Run:
   ```sql
   SELECT * FROM insurance_payments;
   ```
   See if data exists
3. Check RLS policies are set up correctly (they should be from the schema)

### Can't access from different device

**Problem**: Data only visible on one device

**Solution**: Make sure you're using the SAME Supabase project URL and key on all devices

---

## 🗄️ View Your Data in Supabase

**Table Editor**:
- Click **Table Editor** in sidebar
- View, edit, delete records directly
- Download as CSV

**SQL Editor**:
- Run custom SQL queries
- Example: Find all outstanding patients:
  ```sql
  SELECT
    member_subscriber_id,
    payee_name,
    SUM(check_eft_amount) as total
  FROM insurance_payments
  GROUP BY member_subscriber_id, payee_name;
  ```

---

## 🔐 Security Notes

**Current Setup**: Public read/write access
- Anyone with your URL can read/write data
- Fine for personal use or testing
- **NOT** recommended for production with sensitive data

**To Add Security Later**:
1. Implement authentication (Supabase Auth)
2. Update RLS policies to restrict access
3. Add user-based permissions

See `DATABASE_MIGRATION_GUIDE.md` for authentication setup.

---

## 💾 Backup Your Data

**Automatic Backups** (Free tier):
- Supabase backs up your database daily
- Retention: 7 days

**Manual Backup**:
1. Go to **Table Editor**
2. Select a table
3. Click **"•••"** → **"Download as CSV"**
4. Repeat for each table

**Database Dump**:
1. Go to **Settings** → **Database**
2. Click **"Database Settings"**
3. Copy connection string
4. Use `pg_dump` command line tool

---

## 📈 Monitoring

**Database Usage**:
1. Go to **Settings** → **Usage**
2. View:
   - Database size
   - API requests
   - Bandwidth

**Free Tier Limits**:
- 500 MB database
- 50,000 monthly active users
- 2 GB bandwidth

---

## 🚀 Next Steps

1. **Add Authentication**: See `DATABASE_MIGRATION_GUIDE.md`
2. **Deploy to Production**: Use Vercel, Netlify, or Railway
3. **Custom Domain**: Configure in hosting platform
4. **Team Access**: Invite collaborators in Supabase dashboard

---

## 📞 Need Help?

- **Supabase Docs**: https://supabase.com/docs
- **Discord**: https://discord.supabase.com
- **Project Issues**: Check `database-schema.md` for schema details
