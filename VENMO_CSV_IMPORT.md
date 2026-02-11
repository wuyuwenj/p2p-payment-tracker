# Venmo CSV Import Feature

## Overview
Import multiple Venmo payment transactions at once by uploading a CSV export from Venmo. This feature automates the tedious process of manually entering each payment.

## How to Use

### Step 1: Export from Venmo
1. Open Venmo (web or mobile app)
2. Go to **Settings** → **Privacy** → **Download My Venmo Data**
3. Wait for email with download link (usually arrives within minutes)
4. Download and extract the ZIP file
5. Locate the `transactions.csv` file

### Step 2: Upload CSV
1. Navigate to the **Venmo Payments** page in the tracker
2. Click the **"Import Venmo CSV"** card at the top
3. Click **"Choose Venmo CSV file"** and select your `transactions.csv`
4. Click **"Parse CSV"**

### Step 3: Map Patient Names
After parsing, you'll see a mapping interface:

- **Left Column**: Venmo usernames from your CSV
- **Amount**: Total payments from each person
- **Patient Name**: Map to existing patients (autocomplete from insurance records)
- **Member ID**: Automatically fills when you select a patient name
- **Status**: ✅ = Mapped, ⚠️ = Needs mapping

**Tips:**
- The system auto-matches known patients by name
- You can manually type patient names if not in the dropdown
- Unmapped transactions will be skipped during import
- Multiple payments from the same person are grouped

### Step 4: Import
1. Review the mapped transactions
2. Check the total amount and payment count
3. Click **"Import X Payments"**
4. Success! All payments are now in your Venmo Payments table

## What Gets Imported

**Only completed payments YOU RECEIVED** are imported:
- ✅ Completed payments (status = "Complete")
- ✅ Money you received (positive amounts)
- ❌ Charges you sent (negative amounts)
- ❌ Pending/failed transactions

**Data Mapping:**
- **Patient Name**: From your mapping
- **Member ID**: From your mapping
- **Amount**: Payment total (excluding fees)
- **Date**: Transaction date (YYYY-MM-DD format)
- **Notes**: Venmo note/memo + username

## CSV Format

The importer handles standard Venmo CSV exports with these columns:
- `ID` or `Datetime`
- `Type` (Payment/Charge)
- `Status` (Complete/Pending)
- `Note`
- `From` (sender username)
- `To` (recipient username)
- `Amount (total)` or `Amount (fee)`

**Note:** Column names may vary slightly; the parser auto-detects variations.

## Example Workflow

### Scenario
You received 3 Venmo payments:
1. @john-doe sent $50 (2 transactions)
2. @jane-smith sent $100 (1 transaction)

### After Upload
```
Venmo User     | Amount   | Patient Name       | Member ID | Status
-----------------------------------------------------------------------------
@john-doe      | $100.00  | John Doe          | ABC123    | ✅
@jane-smith    | $100.00  | [select patient]  |           | ⚠️
```

### After Mapping
All transactions from @john-doe auto-mapped to "John Doe" (ABC123).  
You select "Jane Smith" (XYZ789) from the dropdown for @jane-smith.

### After Import
Creates 3 payment records:
- John Doe (ABC123): $50, date 1
- John Doe (ABC123): $50, date 2
- Jane Smith (XYZ789): $100, date 1

## Features

✅ **Bulk Import**: Process multiple payments at once  
✅ **Auto-Mapping**: Matches known patient names automatically  
✅ **Smart Filtering**: Only imports completed payments you received  
✅ **Duplicate Prevention**: Review before importing  
✅ **Error Handling**: Clear messages for parsing issues  
✅ **Flexible Mapping**: Manual override for any patient name  

## Troubleshooting

### "Could not find required columns"
- Make sure you're uploading Venmo's official CSV export
- Check that the file hasn't been modified in Excel (column names changed)

### "No valid payment transactions found"
- You may only have sent charges (not received payments) in this period
- Check that transactions are marked "Complete"
- Verify amounts are positive

### Patient name not showing in dropdown
- The patient must exist in your insurance records first
- You can manually type the name and Member ID

### Payments not appearing after import
- Check that you mapped at least one Venmo username
- Unmapped transactions are skipped (by design)
- Refresh the page if you don't see them immediately

## Technical Details

**Supported File Format:** `.csv` (UTF-8 encoding)  
**Max File Size:** Standard browser upload limits (~10MB typical)  
**Date Format:** Auto-converts Venmo's ISO format to YYYY-MM-DD  
**Amount Parsing:** Handles `$`, `,`, `+`, `-` symbols automatically  

**API Endpoint:** Uses existing `POST /api/venmo-payments` (bulk insert)  
**Database:** Stores in `venmoPayment` table via Prisma  

## Security & Privacy

- CSV files are **never uploaded to a server** - parsing happens in your browser
- No Venmo credentials are stored or required
- Only mapped payments are saved to your database
- All data stays within your authenticated session

---

## Future Enhancements

Possible improvements:
- [ ] Save mappings for future imports (remember @username → Patient Name)
- [ ] Import directly from Venmo API (OAuth integration)
- [ ] Conflict detection (warn if duplicate dates/amounts exist)
- [ ] Export unmapped transactions for review
- [ ] Batch edit imported payments before saving

---

**Questions?** Check the main project README or open an issue on GitHub.
