# Insurance Payment Tracker - Complete Feature List

## Navigation Structure

```
┌─────────────────────────────────────────────────────────┐
│          Insurance Payment Tracker                      │
├─────────────────────────────────────────────────────────┤
│  Insurance Payments | Venmo Payments | All Patients |   │
│                       Reconciliation                     │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Page 1: Insurance Payments (Home)

**Purpose**: Import and view all insurance payment records from Excel files

**Features**:
- ✅ Excel file upload (supports .xlsx and .xls)
- ✅ Automatic column mapping for:
  - Claim status
  - Dates of service
  - Member Subscriber ID
  - Provider name
  - Payment date
  - Check number (supports "Chumber" typo)
  - Check/EFT amount
  - Payee name
  - Payee address
- ✅ Full table view with all columns
- ✅ Delete individual records
- ✅ Clear all records
- ✅ Summary statistics (total records, total amount)
- ✅ Responsive table with horizontal scrolling

**Excel Import Notes**:
- Handles column name variations
- Each row = one insurance payment to one patient
- Multiple patients can have same Member ID but different names

---

## 💵 Page 2: Venmo Payments

**Purpose**: Record patient payments received via Venmo or other methods

**Features**:
- ✅ **Smart Autocomplete Search**:
  - Type patient name (2+ characters)
  - Dropdown shows matching patients from insurance records
  - Displays patient name + Member ID
  - Auto-fills both fields when selected
  - Case-insensitive search

- ✅ **Batch Add Functionality**:
  - Enter patient name and Member ID once
  - Add multiple payment rows for same patient
  - Each row has: Amount, Date, Notes (optional)
  - Add/remove rows dynamically

- ✅ Full table view of all Venmo payments
- ✅ Delete individual records
- ✅ Clear all records
- ✅ Summary statistics (total records, total amount)

**Use Case**: After receiving multiple Venmo payments from one patient, enter all of them at once

---

## 👥 Page 3: All Patients (NEW!)

**Purpose**: Searchable list of all patients with payment summaries

**Features**:
- ✅ **Search Functionality**:
  - Search by patient name
  - Search by Member ID
  - Real-time filtering

- ✅ **Status Filters**:
  - All: Show everyone
  - Outstanding: Patients who owe money
  - Paid: Fully paid patients (balance = 0)
  - Overpaid: Patients who paid too much

- ✅ **Summary Statistics Cards**:
  - Total patients (filtered count)
  - Outstanding balance (sum of all positive balances)
  - Total insurance amount
  - Total patient payments

- ✅ **Patient List Table**:
  - Patient name with payment counts
  - Member ID
  - Total insurance received
  - Total patient paid
  - Balance
  - Status badge
  - "View Details" link to patient page

- ✅ Sortable by balance (highest outstanding first)

---

## 📋 Page 4: Patient Details (Excel-like View) (NEW!)

**Purpose**: Detailed view of individual patient's complete payment history

**Features**:
- ✅ **Header Section**:
  - Patient name
  - Member ID
  - Summary cards showing:
    - Total insurance payments
    - Total patient paid
    - Balance with status indicator
  - Back button

- ✅ **Insurance Payments Table** (Excel-like):
  - Claim status
  - Service dates
  - Provider name
  - Payment date
  - Check number
  - Amount (highlighted in blue)
  - Payee address
  - Delete button
  - **Totals row** at bottom

- ✅ **Venmo Payments Table** (Excel-like):
  - Date
  - Amount (highlighted in green)
  - Notes
  - Delete button
  - **Totals row** at bottom

- ✅ **Payment Summary Section**:
  - Side-by-side comparison
  - Insurance vs Patient Paid
  - Outstanding balance calculation
  - Status badge (Paid in Full / Outstanding / Overpaid)

**Access**:
- From "All Patients" page → Click "View Details"
- From "Reconciliation" page → Click "View Details"
- Direct URL: `/patient/[memberID]|||[patientName]`

---

## 🔄 Page 5: Reconciliation

**Purpose**: Compare insurance payments to patient payments for all patients

**Features**:
- ✅ **Summary Dashboard**:
  - Total unique patients
  - Total insurance payments
  - Total patient payments
  - Total outstanding balance

- ✅ **Reconciliation Table**:
  - Member ID
  - Patient name
  - Insurance amount (blue)
  - Patient paid amount (green)
  - Balance (red/yellow/green based on status)
  - Status badge
  - Actions: "View Details" + "Show/Hide"

- ✅ **Expandable Rows**:
  - Click "Show" to expand
  - Shows all insurance payments for that patient
  - Shows all Venmo payments for that patient
  - Side-by-side comparison
  - Detailed breakdown with dates and amounts

- ✅ **Patient Grouping**:
  - Groups by Member Subscriber ID + Patient Name
  - Case-insensitive matching
  - Handles multiple patients with same Member ID

**Key Insight**: One place to see who owes money and who's paid

---

## 🎨 Design Features (All Pages)

### Color Coding
- **Blue**: Insurance payments
- **Green**: Patient payments / Paid in full
- **Red**: Outstanding balance / Money owed
- **Yellow**: Overpaid / Refund needed
- **Gray**: Neutral information

### Status Badges
- 🟢 **Paid in Full**: Balance = $0.00
- 🔴 **Outstanding**: Balance > $0.00
- 🟡 **Overpaid**: Balance < $0.00

### Responsive Design
- Works on desktop and tablet
- Horizontal scrolling for wide tables
- Mobile-friendly navigation

---

## 🔑 Key Workflows

### Workflow 1: Import Insurance Data
1. Go to "Insurance Payments"
2. Click "Import Excel File"
3. Select Excel file
4. Records appear in table

### Workflow 2: Record Patient Payment
1. Go to "Venmo Payments"
2. Click "Add Payments"
3. Start typing patient name
4. Select from dropdown (auto-fills Member ID)
5. Add payment rows (amount, date, notes)
6. Click "Save Payments"

### Workflow 3: Check Patient Balance
**Option A - Search:**
1. Go to "All Patients"
2. Search for patient name
3. Click "View Details"
4. See complete payment history

**Option B - Browse:**
1. Go to "Reconciliation"
2. Find patient in list
3. Click "View Details"
4. See complete payment history

### Workflow 4: Find Outstanding Balances
1. Go to "All Patients"
2. Click "Outstanding" filter
3. See all patients who owe money
4. Sorted by highest balance first

### Workflow 5: Review Individual Patient
1. Navigate to patient detail page (any method)
2. See all insurance payments in one table
3. See all Venmo payments in another table
4. Check balance summary
5. Delete incorrect payments if needed

---

## 💾 Data Storage

**Current**: Browser localStorage
- No database needed
- Data persists in browser
- Unique to each browser/computer

**Patient Identification**:
- Combination of Member Subscriber ID + Patient Name
- Case-insensitive matching
- Example: "12345|||John Doe" (lowercase)

**Future**: Can migrate to database (PostgreSQL/MySQL)
- See `database-schema.md`
- See `DATABASE_MIGRATION_GUIDE.md`

---

## 📱 Navigation Flow

```
Insurance Payments ─────┐
                        │
Venmo Payments ─────────┼──→ All Patients ──→ Patient Details
                        │         ↑                  ↑
Reconciliation ─────────┘         │                  │
                                  └──────────────────┘
```

---

## 🎯 Use Cases

### For Medical Offices
- Import EOB (Explanation of Benefits) from insurance
- Track which patients have been paid by insurance
- Record when patients pay their portion
- Identify patients with outstanding balances

### For Billing Departments
- Search for specific patients quickly
- Filter by payment status
- Generate reconciliation reports
- Audit individual patient accounts

### For Financial Analysis
- Total outstanding receivables
- Payment tracking over time
- Patient payment patterns
- Insurance vs patient payment ratios

---

## 🚀 Quick Start Guide

1. **Import insurance data**: Insurance Payments page → Import Excel
2. **Record patient payments**: Venmo Payments page → Add Payments
3. **Find patient**: All Patients page → Search or filter
4. **View details**: Click "View Details" → See Excel-like tables
5. **Check reconciliation**: Reconciliation page → See summary

---

## ✨ What Makes This Different

1. **No Database Required** - Runs entirely in browser
2. **Excel-like Interface** - Familiar spreadsheet view
3. **Smart Autocomplete** - Fast patient lookup
4. **Batch Entry** - Add multiple payments at once
5. **Multiple Views** - List, detail, reconciliation
6. **Real-time Calculations** - Instant balance updates
7. **Color-coded UI** - Easy visual scanning
8. **Search & Filter** - Find what you need fast
