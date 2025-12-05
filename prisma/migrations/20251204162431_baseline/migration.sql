-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."TrackingStatus" AS ENUM ('PENDING', 'RECORDED', 'NOTIFIED', 'COLLECTED');

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."insurance_payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "claim_status" TEXT,
    "dates_of_service" TEXT,
    "member_subscriber_id" TEXT NOT NULL,
    "provider_name" TEXT,
    "payment_date" TEXT,
    "check_number" TEXT,
    "check_eft_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payee_name" TEXT NOT NULL,
    "payee_address" TEXT,
    "tracking_status" "public"."TrackingStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "email_verified" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."venmo_payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL,
    "member_subscriber_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "date" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venmo_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "public"."accounts"("provider" ASC, "provider_account_id" ASC);

-- CreateIndex
CREATE INDEX "insurance_payments_member_subscriber_id_idx" ON "public"."insurance_payments"("member_subscriber_id" ASC);

-- CreateIndex
CREATE INDEX "insurance_payments_member_subscriber_id_payee_name_idx" ON "public"."insurance_payments"("member_subscriber_id" ASC, "payee_name" ASC);

-- CreateIndex
CREATE INDEX "insurance_payments_payee_name_idx" ON "public"."insurance_payments"("payee_name" ASC);

-- CreateIndex
CREATE INDEX "insurance_payments_payment_date_idx" ON "public"."insurance_payments"("payment_date" ASC);

-- CreateIndex
CREATE INDEX "insurance_payments_user_id_idx" ON "public"."insurance_payments"("user_id" ASC);

-- CreateIndex
CREATE INDEX "insurance_payments_user_id_member_subscriber_id_idx" ON "public"."insurance_payments"("user_id" ASC, "member_subscriber_id" ASC);

-- CreateIndex
CREATE INDEX "insurance_payments_user_id_payee_name_idx" ON "public"."insurance_payments"("user_id" ASC, "payee_name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "public"."sessions"("session_token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE INDEX "venmo_payments_date_idx" ON "public"."venmo_payments"("date" ASC);

-- CreateIndex
CREATE INDEX "venmo_payments_member_subscriber_id_idx" ON "public"."venmo_payments"("member_subscriber_id" ASC);

-- CreateIndex
CREATE INDEX "venmo_payments_member_subscriber_id_patient_name_idx" ON "public"."venmo_payments"("member_subscriber_id" ASC, "patient_name" ASC);

-- CreateIndex
CREATE INDEX "venmo_payments_patient_name_idx" ON "public"."venmo_payments"("patient_name" ASC);

-- CreateIndex
CREATE INDEX "venmo_payments_user_id_idx" ON "public"."venmo_payments"("user_id" ASC);

-- CreateIndex
CREATE INDEX "venmo_payments_user_id_member_subscriber_id_idx" ON "public"."venmo_payments"("user_id" ASC, "member_subscriber_id" ASC);

-- CreateIndex
CREATE INDEX "venmo_payments_user_id_patient_name_idx" ON "public"."venmo_payments"("user_id" ASC, "patient_name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "public"."verification_tokens"("identifier" ASC, "token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "public"."verification_tokens"("token" ASC);

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."insurance_payments" ADD CONSTRAINT "insurance_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."venmo_payments" ADD CONSTRAINT "venmo_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

