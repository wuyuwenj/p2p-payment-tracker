# Insurance Payment Tracker

A Next.js web application for tracking insurance payments and patient reimbursements in a "paid to patient" scenario.

## Features

### 1. Insurance Payments Page
- **Excel Import**: Upload Excel files with insurance payment records
- **Expected Excel Columns**:
  - Claim status
  - Dates of service
  - Member nbscriber ID (or Member Subscriber ID)
  - Provider name
  - Payment date
  - Chumber (or Check Number)
  - Check/EFT amount
  - Payee name
  - Payee address
- View all imported records in a table
- Delete individual records or clear all
- See total records and total amount

### 2. Venmo Payments Page
- **Smart Autocomplete Search**: Type patient name to search from imported insurance records
  - Start typing (2+ characters) to see matching patients
  - Shows patient name and Member ID in dropdown
  - Auto-fills both name and ID when selected
  - Works without any database - uses localStorage
- **Batch Add**: Add multiple Venmo payments for a single patient at once
- Add multiple payment rows with:
  - Amount
  - Date
  - Notes (optional)
- View all Venmo payment records
- Delete individual records or clear all
- See total records and total amount

### 3. All Patients Page
- **Searchable Patient List**: View all patients in one place
- **Smart Search**: Search by patient name or member ID
- **Status Filters**: Filter by All, Outstanding, Paid, or Overpaid
- **Summary Statistics**: See totals for all filtered patients
- **Quick Navigation**: Click "View Details" to see individual patient page

### 4. Patient Details Page (Excel-like View)
- **Dedicated page for each patient** showing all their transactions
- **Excel-like Layout**: Clean, spreadsheet-style tables
- **Two Separate Tables**:
  - Insurance Payments table with all columns (claim status, dates, provider, check #, amount, address)
  - Venmo Payments table with payment details
- **Summary Cards**: Real-time balance calculation showing:
  - Total insurance received
  - Total patient paid
  - Outstanding balance with status
- **Delete Functionality**: Remove individual payments directly from patient view
- **Back Navigation**: Easy return to previous page

### 5. Reconciliation Page
- **Automatic Matching**: Groups payments by combination of Member Subscriber ID + Patient Name
- **Summary Cards**: Shows totals for patients, insurance payments, patient payments, and outstanding balance
- **Status Indicators**:
  - Paid in Full (green)
  - Outstanding (red)
  - Overpaid (yellow)
- **View Details Link**: Navigate directly to patient detail page
- **Quick View**: Click "Show" to expand and see summary of payments inline
- **Balance Calculation**: Shows how much patients still owe or have overpaid

## Getting Started

### Installation
The project is already set up with all dependencies installed.

### Running the Application
```bash
cd insurance-payment-tracker
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Data Storage

**Two Options:**

1. **localStorage (Default)**: No setup required
   - Data stored in browser
   - Works offline
   - Local to your device

2. **PostgreSQL Database (Recommended)**: With Prisma + Supabase
   - Real database persistence
   - Access from any device
   - Share with team
   - Free tier available
   - **Setup Guide**: See `PRISMA_SETUP.md` for 15-minute setup

## How to Use

1. **Import Insurance Payments**:
   - Go to "Insurance Payments" page
   - Click "Import Excel File"
   - Select your Excel file with the required columns
   - Records will be imported and displayed

2. **Add Patient Venmo Payments**:
   - Go to "Venmo Payments" page
   - Click "Add Payments"
   - Enter patient name and member ID
   - Add one or more payment rows
   - Click "Save Payments"

3. **View Reconciliation**:
   - Go to "Reconciliation" page
   - See summary statistics
   - Click "Show" on any row to see detailed payment breakdown
   - Monitor which patients have outstanding balances

## Technology Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Excel Processing**: xlsx library
- **Storage**: Browser localStorage

## Project Structure

```
insurance-payment-tracker/
├── app/
│   ├── page.tsx                    # Insurance Payments page
│   ├── venmo/
│   │   └── page.tsx                # Venmo Payments page
│   ├── reconciliation/
│   │   └── page.tsx                # Reconciliation page
│   └── layout.tsx                  # Root layout with navigation
├── components/
│   └── Navigation.tsx              # Navigation bar
├── lib/
│   ├── types.ts                    # TypeScript interfaces
│   └── storage.ts                  # localStorage utilities
└── README.md
```

## Notes

- Excel files should have headers matching the expected column names
- **Patient Identification**: Each unique patient is identified by the combination of Member Subscriber ID + Payee Name/Patient Name
  - This means you can have multiple different patients with the same Member ID, as long as they have different names
  - When adding Venmo payments, make sure the Member ID and Patient Name match exactly (case-insensitive) with the insurance records
- All monetary values are displayed with 2 decimal places
- Data is stored locally in your browser
