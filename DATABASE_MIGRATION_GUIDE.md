# Database Migration Guide

This guide will help you migrate from localStorage to a real database.

## Current Architecture

```
┌─────────────┐
│   Browser   │
│ (Next.js)   │
│             │
│ localStorage│ ← Current: All data stored here
└─────────────┘
```

## Target Architecture

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   Browser   │  HTTP   │   Backend    │  SQL    │   Database   │
│ (Next.js)   │ ◄─────► │ (API Routes) │ ◄─────► │ (PostgreSQL) │
└─────────────┘         └──────────────┘         └──────────────┘
```

---

## Step 1: Choose Your Database

### Option A: PostgreSQL (Recommended)
- **Pros**: Robust, great for complex queries, free
- **Hosting**: Supabase (free tier), Railway, Render, AWS RDS
- **Setup Difficulty**: Medium

### Option B: MySQL
- **Pros**: Very common, lots of hosting options
- **Hosting**: PlanetScale (free tier), Railway, AWS RDS
- **Setup Difficulty**: Medium

### Option C: SQLite
- **Pros**: Simple, no hosting needed, single file
- **Hosting**: Embedded in your app
- **Setup Difficulty**: Easy
- **Cons**: Not for multi-user scenarios

---

## Step 2: Set Up Database (Using Supabase - Free)

### 2.1 Create Supabase Account
1. Go to https://supabase.com
2. Sign up for free account
3. Create new project
4. Save your database credentials

### 2.2 Run Schema Setup
1. Go to SQL Editor in Supabase dashboard
2. Copy and paste the PostgreSQL schema from `database-schema.md`
3. Execute the SQL

---

## Step 3: Install Required Packages

```bash
cd insurance-payment-tracker
npm install @supabase/supabase-js
```

If using Prisma (ORM - recommended):
```bash
npm install prisma @prisma/client
npx prisma init
```

---

## Step 4: Create Environment Variables

Create `.env.local` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Or for direct PostgreSQL connection
DATABASE_URL=postgresql://user:password@host:5432/database
```

---

## Step 5: Create Database Client

### Option A: Using Supabase Client (Easier)

Create `lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)
```

### Option B: Using Prisma (More Structured)

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model InsurancePayment {
  id                 String   @id @default(uuid())
  claimStatus        String?
  datesOfService     String?
  memberSubscriberID String
  providerName       String?
  paymentDate        DateTime?
  checkNumber        String?
  checkEFTAmount     Decimal  @default(0)
  payeeName          String
  payeeAddress       String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([memberSubscriberID, payeeName])
  @@map("insurance_payments")
}

model VenmoPayment {
  id                 String   @id @default(uuid())
  patientName        String
  memberSubscriberID String
  amount             Decimal
  date               DateTime
  notes              String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([memberSubscriberID, patientName])
  @@map("venmo_payments")
}
```

Then run:
```bash
npx prisma generate
npx prisma db push
```

---

## Step 6: Create New Storage Layer (Database Version)

Create `lib/db-storage.ts`:

```typescript
import { supabase } from './supabase'
import { InsurancePayment, VenmoPayment } from './types'

export const dbStorage = {
  // Insurance Payments
  getInsurancePayments: async (): Promise<InsurancePayment[]> => {
    const { data, error } = await supabase
      .from('insurance_payments')
      .select('*')
      .order('payment_date', { ascending: false })

    if (error) throw error
    return data || []
  },

  addInsurancePayments: async (payments: Omit<InsurancePayment, 'id'>[]): Promise<void> => {
    const { error } = await supabase
      .from('insurance_payments')
      .insert(payments)

    if (error) throw error
  },

  deleteInsurancePayment: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('insurance_payments')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Venmo Payments
  getVenmoPayments: async (): Promise<VenmoPayment[]> => {
    const { data, error } = await supabase
      .from('venmo_payments')
      .select('*')
      .order('date', { ascending: false })

    if (error) throw error
    return data || []
  },

  addVenmoPayments: async (payments: Omit<VenmoPayment, 'id'>[]): Promise<void> => {
    const { error } = await supabase
      .from('venmo_payments')
      .insert(payments)

    if (error) throw error
  },

  deleteVenmoPayment: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('venmo_payments')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Get unique patients for autocomplete
  getUniquePatients: async () => {
    const { data, error } = await supabase
      .from('insurance_payments')
      .select('member_subscriber_id, payee_name')
      .order('payee_name')

    if (error) throw error

    // Remove duplicates
    const uniquePatients = new Map()
    data?.forEach(p => {
      const key = `${p.member_subscriber_id}|||${p.payee_name}`.toLowerCase()
      if (!uniquePatients.has(key)) {
        uniquePatients.set(key, {
          memberId: p.member_subscriber_id,
          name: p.payee_name
        })
      }
    })

    return Array.from(uniquePatients.values())
  }
}
```

---

## Step 7: Update Components to Use Database

### Example: Update Insurance Payments Page

Change from:
```typescript
// Old localStorage version
useEffect(() => {
  setPayments(storage.getInsurancePayments());
  setLoading(false);
}, []);
```

To:
```typescript
// New database version
useEffect(() => {
  loadPayments();
}, []);

const loadPayments = async () => {
  try {
    const data = await dbStorage.getInsurancePayments();
    setPayments(data);
  } catch (error) {
    console.error('Error loading payments:', error);
    alert('Failed to load payments');
  } finally {
    setLoading(false);
  }
};
```

---

## Step 8: Migration Script (Export from localStorage)

Create `scripts/export-data.js`:

```javascript
// Run this in browser console on your current app
const exportData = () => {
  const insurancePayments = localStorage.getItem('insurancePayments');
  const venmoPayments = localStorage.getItem('venmoPayments');

  const data = {
    insurancePayments: insurancePayments ? JSON.parse(insurancePayments) : [],
    venmoPayments: venmoPayments ? JSON.parse(venmoPayments) : []
  };

  // Download as JSON
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'payment-data-export.json';
  a.click();
};

exportData();
```

Then create import script `scripts/import-to-db.ts`:

```typescript
import { supabase } from '../lib/supabase'
import exportedData from './payment-data-export.json'

async function importData() {
  // Import insurance payments
  const { error: insuranceError } = await supabase
    .from('insurance_payments')
    .insert(exportedData.insurancePayments)

  if (insuranceError) {
    console.error('Insurance import error:', insuranceError)
    return
  }

  // Import venmo payments
  const { error: venmoError } = await supabase
    .from('venmo_payments')
    .insert(exportedData.venmoPayments)

  if (venmoError) {
    console.error('Venmo import error:', venmoError)
    return
  }

  console.log('Data imported successfully!')
}

importData()
```

---

## Step 9: Add Authentication (Optional but Recommended)

### Using Supabase Auth

```typescript
// lib/auth.ts
import { supabase } from './supabase'

export const auth = {
  signUp: async (email: string, password: string) => {
    return await supabase.auth.signUp({ email, password })
  },

  signIn: async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password })
  },

  signOut: async () => {
    return await supabase.auth.signOut()
  },

  getUser: async () => {
    return await supabase.auth.getUser()
  }
}
```

---

## Step 10: Deploy

### Option A: Vercel (Recommended for Next.js)
1. Push code to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Option B: Railway
1. Connect GitHub repo
2. Add environment variables
3. Deploy

---

## Comparison: Before vs After

| Feature | localStorage | Database |
|---------|--------------|----------|
| Multi-device access | ❌ | ✅ |
| Team collaboration | ❌ | ✅ |
| Data persistence | ⚠️ Browser only | ✅ Permanent |
| Backup | ❌ Manual | ✅ Automatic |
| Search performance | ⚠️ Slow with lots of data | ✅ Fast with indexes |
| Security | ⚠️ Client-side only | ✅ Server-side |
| Cost | ✅ Free | ✅ Free tier available |

---

## Estimated Migration Time

- Basic setup: 2-4 hours
- With authentication: 4-6 hours
- Testing & deployment: 1-2 hours
- **Total: 1 day of work**

---

## Need Help?

If you want me to implement the database migration for you, I can:
1. Set up Supabase integration
2. Create all the database functions
3. Update all components
4. Add authentication
5. Create migration scripts

Just let me know which database provider you prefer!
