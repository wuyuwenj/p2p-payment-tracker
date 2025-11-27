# Database Schema Design

## Overview
This document describes the database schema for the Insurance Payment Tracker application. The schema consists of 3 main tables with optional patient normalization.

---

## Schema Diagrams

### Current Simple Design (2 Tables)
```
┌─────────────────────────┐         ┌──────────────────────┐
│  insurance_payments     │         │   venmo_payments     │
├─────────────────────────┤         ├──────────────────────┤
│ id (PK)                 │         │ id (PK)              │
│ claim_status            │         │ patient_name         │
│ dates_of_service        │         │ member_subscriber_id │
│ member_subscriber_id    │         │ amount               │
│ provider_name           │         │ date                 │
│ payment_date            │         │ notes                │
│ check_number            │         │ created_at           │
│ check_eft_amount        │         │ updated_at           │
│ payee_name              │         └──────────────────────┘
│ payee_address           │
│ created_at              │
│ updated_at              │
└─────────────────────────┘

Relationship: Linked by (member_subscriber_id + payee_name/patient_name)
```

### Normalized Design with Patient Table (3 Tables - Recommended for Production)
```
┌─────────────────────────┐         ┌──────────────────────┐
│      patients           │    ┌────│ insurance_payments   │
├─────────────────────────┤    │    ├──────────────────────┤
│ id (PK)                 │◄───┘    │ id (PK)              │
│ member_subscriber_id    │         │ patient_id (FK)      │
│ full_name               │    ┌────│ claim_status         │
│ address                 │    │    │ dates_of_service     │
│ created_at              │    │    │ provider_name        │
│ updated_at              │    │    │ payment_date         │
└─────────────────────────┘    │    │ check_number         │
                               │    │ check_eft_amount     │
                               │    │ created_at           │
                               │    │ updated_at           │
                               │    └──────────────────────┘
                               │
                               │    ┌──────────────────────┐
                               └────│  venmo_payments      │
                                    ├──────────────────────┤
                                    │ id (PK)              │
                                    │ patient_id (FK)      │
                                    │ amount               │
                                    │ date                 │
                                    │ notes                │
                                    │ created_at           │
                                    │ updated_at           │
                                    └──────────────────────┘
```

---

## SQL Schema - PostgreSQL

### Option 1: Simple Design (Current Structure)

```sql
-- Insurance Payments Table
CREATE TABLE insurance_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_status VARCHAR(100),
    dates_of_service VARCHAR(255),
    member_subscriber_id VARCHAR(100) NOT NULL,
    provider_name VARCHAR(255),
    payment_date DATE,
    check_number VARCHAR(100),
    check_eft_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payee_name VARCHAR(255) NOT NULL,
    payee_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Venmo Payments Table
CREATE TABLE venmo_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_name VARCHAR(255) NOT NULL,
    member_subscriber_id VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX idx_insurance_member_id ON insurance_payments(member_subscriber_id);
CREATE INDEX idx_insurance_payee_name ON insurance_payments(payee_name);
CREATE INDEX idx_insurance_payment_date ON insurance_payments(payment_date);

CREATE INDEX idx_venmo_member_id ON venmo_payments(member_subscriber_id);
CREATE INDEX idx_venmo_patient_name ON venmo_payments(patient_name);
CREATE INDEX idx_venmo_date ON venmo_payments(date);

-- Composite index for reconciliation queries
CREATE INDEX idx_insurance_member_payee ON insurance_payments(member_subscriber_id, payee_name);
CREATE INDEX idx_venmo_member_patient ON venmo_payments(member_subscriber_id, patient_name);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_insurance_payments_updated_at BEFORE UPDATE ON insurance_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_venmo_payments_updated_at BEFORE UPDATE ON venmo_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Option 2: Normalized Design with Patient Table (Recommended)

```sql
-- Patients Table (normalized)
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_subscriber_id VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(member_subscriber_id, full_name)
);

-- Insurance Payments Table (with foreign key)
CREATE TABLE insurance_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    claim_status VARCHAR(100),
    dates_of_service VARCHAR(255),
    provider_name VARCHAR(255),
    payment_date DATE,
    check_number VARCHAR(100),
    check_eft_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Venmo Payments Table (with foreign key)
CREATE TABLE venmo_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_patients_member_id ON patients(member_subscriber_id);
CREATE INDEX idx_patients_name ON patients(full_name);
CREATE INDEX idx_insurance_patient_id ON insurance_payments(patient_id);
CREATE INDEX idx_insurance_payment_date ON insurance_payments(payment_date);
CREATE INDEX idx_venmo_patient_id ON venmo_payments(patient_id);
CREATE INDEX idx_venmo_date ON venmo_payments(date);

-- Triggers for updated_at
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_insurance_payments_updated_at BEFORE UPDATE ON insurance_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_venmo_payments_updated_at BEFORE UPDATE ON venmo_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## SQL Schema - MySQL

### Option 1: Simple Design

```sql
-- Insurance Payments Table
CREATE TABLE insurance_payments (
    id VARCHAR(36) PRIMARY KEY,
    claim_status VARCHAR(100),
    dates_of_service VARCHAR(255),
    member_subscriber_id VARCHAR(100) NOT NULL,
    provider_name VARCHAR(255),
    payment_date DATE,
    check_number VARCHAR(100),
    check_eft_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payee_name VARCHAR(255) NOT NULL,
    payee_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_member_id (member_subscriber_id),
    INDEX idx_payee_name (payee_name),
    INDEX idx_payment_date (payment_date),
    INDEX idx_member_payee (member_subscriber_id, payee_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Venmo Payments Table
CREATE TABLE venmo_payments (
    id VARCHAR(36) PRIMARY KEY,
    patient_name VARCHAR(255) NOT NULL,
    member_subscriber_id VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_member_id (member_subscriber_id),
    INDEX idx_patient_name (patient_name),
    INDEX idx_date (date),
    INDEX idx_member_patient (member_subscriber_id, patient_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Option 2: Normalized Design

```sql
-- Patients Table
CREATE TABLE patients (
    id VARCHAR(36) PRIMARY KEY,
    member_subscriber_id VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_patient (member_subscriber_id, full_name),
    INDEX idx_member_id (member_subscriber_id),
    INDEX idx_name (full_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insurance Payments Table
CREATE TABLE insurance_payments (
    id VARCHAR(36) PRIMARY KEY,
    patient_id VARCHAR(36) NOT NULL,
    claim_status VARCHAR(100),
    dates_of_service VARCHAR(255),
    provider_name VARCHAR(255),
    payment_date DATE,
    check_number VARCHAR(100),
    check_eft_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    INDEX idx_patient_id (patient_id),
    INDEX idx_payment_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Venmo Payments Table
CREATE TABLE venmo_payments (
    id VARCHAR(36) PRIMARY KEY,
    patient_id VARCHAR(36) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    INDEX idx_patient_id (patient_id),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Key Reconciliation Queries

### Simple Design Reconciliation Query (PostgreSQL)

```sql
-- Get reconciliation summary for all patients
WITH insurance_summary AS (
    SELECT
        member_subscriber_id,
        payee_name,
        SUM(check_eft_amount) as total_insurance_amount,
        COUNT(*) as insurance_count
    FROM insurance_payments
    GROUP BY member_subscriber_id, payee_name
),
venmo_summary AS (
    SELECT
        member_subscriber_id,
        patient_name,
        SUM(amount) as total_patient_paid,
        COUNT(*) as venmo_count
    FROM venmo_payments
    GROUP BY member_subscriber_id, patient_name
)
SELECT
    COALESCE(i.member_subscriber_id, v.member_subscriber_id) as member_subscriber_id,
    COALESCE(i.payee_name, v.patient_name) as patient_name,
    COALESCE(i.total_insurance_amount, 0) as total_insurance_amount,
    COALESCE(v.total_patient_paid, 0) as total_patient_paid,
    COALESCE(i.total_insurance_amount, 0) - COALESCE(v.total_patient_paid, 0) as balance,
    COALESCE(i.insurance_count, 0) as insurance_payment_count,
    COALESCE(v.venmo_count, 0) as venmo_payment_count
FROM insurance_summary i
FULL OUTER JOIN venmo_summary v
    ON LOWER(i.member_subscriber_id) = LOWER(v.member_subscriber_id)
    AND LOWER(i.payee_name) = LOWER(v.patient_name)
ORDER BY balance DESC;
```

### Normalized Design Reconciliation Query

```sql
-- Get reconciliation summary using normalized patient table
SELECT
    p.id,
    p.member_subscriber_id,
    p.full_name,
    COALESCE(SUM(ip.check_eft_amount), 0) as total_insurance_amount,
    COALESCE(SUM(vp.amount), 0) as total_patient_paid,
    COALESCE(SUM(ip.check_eft_amount), 0) - COALESCE(SUM(vp.amount), 0) as balance,
    COUNT(DISTINCT ip.id) as insurance_payment_count,
    COUNT(DISTINCT vp.id) as venmo_payment_count
FROM patients p
LEFT JOIN insurance_payments ip ON p.id = ip.patient_id
LEFT JOIN venmo_payments vp ON p.id = vp.patient_id
GROUP BY p.id, p.member_subscriber_id, p.full_name
ORDER BY balance DESC;
```

---

## Additional Useful Queries

### Find Outstanding Balances

```sql
-- Patients with outstanding balance > 0
SELECT
    member_subscriber_id,
    patient_name,
    total_insurance - total_venmo as outstanding
FROM (
    SELECT
        COALESCE(i.member_subscriber_id, v.member_subscriber_id) as member_subscriber_id,
        COALESCE(i.payee_name, v.patient_name) as patient_name,
        COALESCE(SUM(i.check_eft_amount), 0) as total_insurance,
        COALESCE(SUM(v.amount), 0) as total_venmo
    FROM insurance_payments i
    FULL OUTER JOIN venmo_payments v
        ON i.member_subscriber_id = v.member_subscriber_id
        AND i.payee_name = v.patient_name
    GROUP BY i.member_subscriber_id, i.payee_name, v.member_subscriber_id, v.patient_name
) subquery
WHERE (total_insurance - total_venmo) > 0
ORDER BY outstanding DESC;
```

### Payment History for a Specific Patient

```sql
-- Get all payments for a specific patient
SELECT
    'Insurance' as payment_type,
    payment_date as date,
    check_eft_amount as amount,
    check_number as reference,
    claim_status as status
FROM insurance_payments
WHERE member_subscriber_id = 'ABC123'
  AND LOWER(payee_name) = LOWER('John Doe')

UNION ALL

SELECT
    'Venmo' as payment_type,
    date,
    amount,
    notes as reference,
    'Completed' as status
FROM venmo_payments
WHERE member_subscriber_id = 'ABC123'
  AND LOWER(patient_name) = LOWER('John Doe')

ORDER BY date DESC;
```

---

## TypeScript Interfaces (Current)

```typescript
export interface InsurancePayment {
  id: string;
  claimStatus: string;
  datesOfService: string;
  memberSubscriberID: string;
  providerName: string;
  paymentDate: string;
  checkNumber: string;
  checkEFTAmount: number;
  payeeName: string;
  payeeAddress: string;
}

export interface VenmoPayment {
  id: string;
  patientName: string;
  memberSubscriberID: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface ReconciliationRecord {
  memberSubscriberID: string;
  patientName: string;
  totalInsuranceAmount: number;
  totalPatientPaid: number;
  balance: number;
  insurancePayments: InsurancePayment[];
  venmoPayments: VenmoPayment[];
}
```

---

## Recommendations

1. **For Small Scale (1-100 patients)**: Use Simple Design (Option 1)
2. **For Production/Growth**: Use Normalized Design (Option 2)
3. **Database Choice**:
   - PostgreSQL: Better for complex queries, JSONB support, full-text search
   - MySQL: More common, easier hosting, good performance
   - SQLite: If staying single-user but want better persistence than localStorage

4. **Next Steps for Database Integration**:
   - Choose a backend framework (Node.js/Express, Next.js API routes, etc.)
   - Set up database connection pool
   - Create API endpoints for CRUD operations
   - Replace localStorage calls with API calls
   - Add authentication/authorization if multi-user
