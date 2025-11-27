-- Insurance Payments Table
CREATE TABLE IF NOT EXISTS insurance_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_status VARCHAR(100),
    dates_of_service VARCHAR(255),
    member_subscriber_id VARCHAR(100) NOT NULL,
    provider_name VARCHAR(255),
    payment_date VARCHAR(100),
    check_number VARCHAR(100),
    check_eft_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payee_name VARCHAR(255) NOT NULL,
    payee_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Venmo Payments Table
CREATE TABLE IF NOT EXISTS venmo_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_name VARCHAR(255) NOT NULL,
    member_subscriber_id VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    date VARCHAR(100) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_insurance_member_id ON insurance_payments(member_subscriber_id);
CREATE INDEX IF NOT EXISTS idx_insurance_payee_name ON insurance_payments(payee_name);
CREATE INDEX IF NOT EXISTS idx_insurance_payment_date ON insurance_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_insurance_member_payee ON insurance_payments(member_subscriber_id, payee_name);

CREATE INDEX IF NOT EXISTS idx_venmo_member_id ON venmo_payments(member_subscriber_id);
CREATE INDEX IF NOT EXISTS idx_venmo_patient_name ON venmo_payments(patient_name);
CREATE INDEX IF NOT EXISTS idx_venmo_date ON venmo_payments(date);
CREATE INDEX IF NOT EXISTS idx_venmo_member_patient ON venmo_payments(member_subscriber_id, patient_name);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_insurance_payments_updated_at
BEFORE UPDATE ON insurance_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_venmo_payments_updated_at
BEFORE UPDATE ON venmo_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE insurance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE venmo_payments ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (you can make this more restrictive later)
CREATE POLICY "Allow all operations on insurance_payments" ON insurance_payments
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on venmo_payments" ON venmo_payments
    FOR ALL USING (true) WITH CHECK (true);
