-- CreateEnum
CREATE TYPE "RestrictionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RestrictionTargetType" AS ENUM ('PATIENT', 'HOSPITAL');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('EMAIL', 'MOBILE');

-- CreateEnum
CREATE TYPE "PendingChangeStatus" AS ENUM ('PENDING', 'VERIFIED', 'CONSUMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AccountDeletionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "HealthDataSource" AS ENUM ('DATA_GOV_IN', 'PM_JAY', 'API_SETU', 'EXTERNAL_SOURCE');

-- CreateEnum
CREATE TYPE "GovDataSyncStatus" AS ENUM ('NOT_CONFIGURED', 'READY', 'SYNCING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING_REVIEW', 'MATCHED', 'REJECTED', 'UNMATCHED');

-- CreateEnum
CREATE TYPE "MatchConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "HospitalSecurityStatusType" AS ENUM ('ACTIVE', 'WARNING', 'TEMPORARILY_BLOCKED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "CaptureViolationType" AS ENUM ('SCREENSHOT_ATTEMPT', 'SCREEN_CAPTURE_DETECTED', 'SCREEN_RECORDING_DETECTED', 'SCREEN_MIRRORING_DETECTED', 'PROTECTED_CONTENT_CAPTURE');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "UrlTokenAction" AS ENUM ('VIEW', 'DOWNLOAD', 'SHARE', 'EMERGENCY_READ');

-- CreateEnum
CREATE TYPE "UrlTokenResourceType" AS ENUM ('HEALTH_PACK', 'EMERGENCY_CASE', 'MEDICAL_DOCUMENT', 'GOVERNMENT_RECORD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CAPTURE_VIOLATION';
ALTER TYPE "AuditAction" ADD VALUE 'CAPTURE_WARNING_ISSUED';
ALTER TYPE "AuditAction" ADD VALUE 'HOSPITAL_TEMPORARILY_BLOCKED';
ALTER TYPE "AuditAction" ADD VALUE 'HOSPITAL_APPEAL_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'HOSPITAL_BLOCK_REVIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'HOSPITAL_UNLOCKED';
ALTER TYPE "AuditAction" ADD VALUE 'HOSPITAL_SESSION_REVOKED';

-- DropForeignKey
ALTER TABLE "medical_documents" DROP CONSTRAINT "medical_documents_healthPackId_fkey";

-- AlterTable
ALTER TABLE "emergency_cases" ADD COLUMN     "medicalSummary" JSONB;

-- AlterTable
ALTER TABLE "hospital_requests" ALTER COLUMN "requestedAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "medical_documents" ADD COLUMN     "documentType" TEXT DEFAULT 'OTHER',
ADD COLUMN     "patientId" TEXT,
ALTER COLUMN "healthPackId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "conditions" TEXT,
ADD COLUMN     "diabetesStatus" TEXT DEFAULT 'UNKNOWN',
ADD COLUMN     "heartCondition" TEXT DEFAULT 'UNKNOWN',
ADD COLUMN     "hypertensionStatus" TEXT DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notificationPreferences" JSONB;

-- CreateTable
CREATE TABLE "hospital_staff" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "specialty" TEXT,
    "department" TEXT,
    "staffId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "dutyStatus" TEXT NOT NULL DEFAULT 'OFF_DUTY',
    "clinicalRole" TEXT,
    "dutyResponsibilities" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_restrictions" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetType" "RestrictionTargetType" NOT NULL,
    "status" "RestrictionStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,

    CONSTRAINT "account_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_credential_changes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CredentialType" NOT NULL,
    "newValue" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "status" "PendingChangeStatus" NOT NULL DEFAULT 'PENDING',
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_credential_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_deletion_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "role" "Role" NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "usernameSnapshot" TEXT NOT NULL,
    "emailSnapshot" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AccountDeletionStatus" NOT NULL DEFAULT 'PENDING',
    "adminReason" TEXT,
    "reviewedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "government_health_records" (
    "id" TEXT NOT NULL,
    "source" "HealthDataSource" NOT NULL DEFAULT 'DATA_GOV_IN',
    "sourceDataset" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT,
    "address" TEXT,
    "pincode" TEXT,
    "hospitalType" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "bedCount" INTEGER,
    "category" TEXT,
    "admissionData" JSONB,
    "rawData" JSONB,
    "licenseInfo" TEXT DEFAULT 'Government Open Data License - India',
    "sourceUrl" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "government_health_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "government_sync_logs" (
    "id" TEXT NOT NULL,
    "source" "HealthDataSource" NOT NULL,
    "status" "GovDataSyncStatus" NOT NULL DEFAULT 'READY',
    "sourceDataset" TEXT NOT NULL,
    "recordsCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "government_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_matches" (
    "id" TEXT NOT NULL,
    "careSetuHospitalId" TEXT NOT NULL,
    "governmentRecordId" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "confidenceLevel" "MatchConfidenceLevel" NOT NULL DEFAULT 'MEDIUM',
    "confidenceScore" DOUBLE PRECISION,
    "matchingMethod" TEXT NOT NULL DEFAULT 'DETERMINISTIC_MULTI_SIGNAL',
    "matchReasons" JSONB NOT NULL,
    "conflictReasons" JSONB NOT NULL,
    "evidenceSnapshot" JSONB,
    "distanceKm" DOUBLE PRECISION,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "unmatchedBy" TEXT,
    "unmatchedAt" TIMESTAMP(3),
    "unmatchReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_security_statuses" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "status" "HospitalSecurityStatusType" NOT NULL DEFAULT 'ACTIVE',
    "violationCount" INTEGER NOT NULL DEFAULT 0,
    "currentViolationCount" INTEGER NOT NULL DEFAULT 0,
    "historicalViolationCount" INTEGER NOT NULL DEFAULT 0,
    "securityEpoch" INTEGER NOT NULL DEFAULT 1,
    "blockedAt" TIMESTAMP(3),
    "blockedUntil" TIMESTAMP(3),
    "lastViolationAt" TIMESTAMP(3),
    "unblockedAt" TIMESTAMP(3),
    "unblockedBy" TEXT,
    "blockReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_security_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capture_violations" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "hospitalUserId" TEXT NOT NULL,
    "patientId" TEXT,
    "caseId" TEXT,
    "documentId" TEXT,
    "healthPackId" TEXT,
    "secureViewerSessionId" TEXT,
    "securityEpoch" INTEGER NOT NULL DEFAULT 1,
    "eventType" "CaptureViolationType" NOT NULL DEFAULT 'SCREENSHOT_ATTEMPT',
    "platform" TEXT NOT NULL DEFAULT 'WEB',
    "attemptNumber" INTEGER NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL DEFAULT 'HIGH',
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capture_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_security_appeals" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reviewReference" TEXT,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "decision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_security_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secure_view_sessions" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "documentId" TEXT,
    "healthPackId" TEXT,
    "securityEpoch" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "secure_view_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "url_share_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "resourceType" "UrlTokenResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "allowedAction" "UrlTokenAction" NOT NULL DEFAULT 'VIEW',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "isOneTime" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "url_share_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opaque_routes" (
    "id" TEXT NOT NULL,
    "opaque_id" TEXT NOT NULL,
    "target_path" TEXT NOT NULL,
    "user_id" TEXT,
    "role" "Role",
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opaque_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_idempotency_records" (
    "id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospital_idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hospital_staff_hospitalId_idx" ON "hospital_staff"("hospitalId");

-- CreateIndex
CREATE INDEX "hospital_staff_dutyStatus_idx" ON "hospital_staff"("dutyStatus");

-- CreateIndex
CREATE INDEX "hospital_staff_isActive_idx" ON "hospital_staff"("isActive");

-- CreateIndex
CREATE INDEX "account_restrictions_targetUserId_idx" ON "account_restrictions"("targetUserId");

-- CreateIndex
CREATE INDEX "account_restrictions_targetType_idx" ON "account_restrictions"("targetType");

-- CreateIndex
CREATE INDEX "account_restrictions_status_idx" ON "account_restrictions"("status");

-- CreateIndex
CREATE INDEX "account_restrictions_createdBy_idx" ON "account_restrictions"("createdBy");

-- CreateIndex
CREATE INDEX "pending_credential_changes_userId_idx" ON "pending_credential_changes"("userId");

-- CreateIndex
CREATE INDEX "pending_credential_changes_type_idx" ON "pending_credential_changes"("type");

-- CreateIndex
CREATE INDEX "pending_credential_changes_status_idx" ON "pending_credential_changes"("status");

-- CreateIndex
CREATE INDEX "account_deletion_requests_userId_idx" ON "account_deletion_requests"("userId");

-- CreateIndex
CREATE INDEX "account_deletion_requests_role_idx" ON "account_deletion_requests"("role");

-- CreateIndex
CREATE INDEX "account_deletion_requests_status_idx" ON "account_deletion_requests"("status");

-- CreateIndex
CREATE INDEX "account_deletion_requests_createdAt_idx" ON "account_deletion_requests"("createdAt");

-- CreateIndex
CREATE INDEX "government_health_records_source_idx" ON "government_health_records"("source");

-- CreateIndex
CREATE INDEX "government_health_records_state_idx" ON "government_health_records"("state");

-- CreateIndex
CREATE INDEX "government_health_records_district_idx" ON "government_health_records"("district");

-- CreateIndex
CREATE INDEX "government_health_records_hospitalName_idx" ON "government_health_records"("hospitalName");

-- CreateIndex
CREATE INDEX "government_health_records_pincode_idx" ON "government_health_records"("pincode");

-- CreateIndex
CREATE UNIQUE INDEX "government_health_records_source_sourceRecordId_key" ON "government_health_records"("source", "sourceRecordId");

-- CreateIndex
CREATE INDEX "government_sync_logs_source_idx" ON "government_sync_logs"("source");

-- CreateIndex
CREATE INDEX "government_sync_logs_status_idx" ON "government_sync_logs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "government_sync_logs_source_sourceDataset_key" ON "government_sync_logs"("source", "sourceDataset");

-- CreateIndex
CREATE INDEX "hospital_matches_careSetuHospitalId_idx" ON "hospital_matches"("careSetuHospitalId");

-- CreateIndex
CREATE INDEX "hospital_matches_governmentRecordId_idx" ON "hospital_matches"("governmentRecordId");

-- CreateIndex
CREATE INDEX "hospital_matches_status_idx" ON "hospital_matches"("status");

-- CreateIndex
CREATE INDEX "hospital_matches_confidenceLevel_idx" ON "hospital_matches"("confidenceLevel");

-- CreateIndex
CREATE INDEX "hospital_matches_createdAt_idx" ON "hospital_matches"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_matches_careSetuHospitalId_governmentRecordId_key" ON "hospital_matches"("careSetuHospitalId", "governmentRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_security_statuses_hospitalId_key" ON "hospital_security_statuses"("hospitalId");

-- CreateIndex
CREATE INDEX "hospital_security_statuses_hospitalId_idx" ON "hospital_security_statuses"("hospitalId");

-- CreateIndex
CREATE INDEX "hospital_security_statuses_status_idx" ON "hospital_security_statuses"("status");

-- CreateIndex
CREATE INDEX "capture_violations_hospitalId_idx" ON "capture_violations"("hospitalId");

-- CreateIndex
CREATE INDEX "capture_violations_hospitalUserId_idx" ON "capture_violations"("hospitalUserId");

-- CreateIndex
CREATE INDEX "capture_violations_caseId_idx" ON "capture_violations"("caseId");

-- CreateIndex
CREATE INDEX "capture_violations_detectedAt_idx" ON "capture_violations"("detectedAt");

-- CreateIndex
CREATE INDEX "hospital_security_appeals_hospitalId_idx" ON "hospital_security_appeals"("hospitalId");

-- CreateIndex
CREATE INDEX "hospital_security_appeals_status_idx" ON "hospital_security_appeals"("status");

-- CreateIndex
CREATE INDEX "hospital_security_appeals_submittedAt_idx" ON "hospital_security_appeals"("submittedAt");

-- CreateIndex
CREATE INDEX "secure_view_sessions_hospitalId_idx" ON "secure_view_sessions"("hospitalId");

-- CreateIndex
CREATE INDEX "secure_view_sessions_caseId_idx" ON "secure_view_sessions"("caseId");

-- CreateIndex
CREATE INDEX "secure_view_sessions_securityEpoch_idx" ON "secure_view_sessions"("securityEpoch");

-- CreateIndex
CREATE UNIQUE INDEX "url_share_tokens_tokenHash_key" ON "url_share_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "url_share_tokens_tokenHash_idx" ON "url_share_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "url_share_tokens_resourceType_resourceId_idx" ON "url_share_tokens"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "url_share_tokens_expiresAt_idx" ON "url_share_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "url_share_tokens_createdByUserId_idx" ON "url_share_tokens"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "opaque_routes_opaque_id_key" ON "opaque_routes"("opaque_id");

-- CreateIndex
CREATE INDEX "opaque_routes_opaque_id_idx" ON "opaque_routes"("opaque_id");

-- CreateIndex
CREATE INDEX "opaque_routes_user_id_idx" ON "opaque_routes"("user_id");

-- CreateIndex
CREATE INDEX "opaque_routes_expires_at_idx" ON "opaque_routes"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_idempotency_records_operation_id_key" ON "hospital_idempotency_records"("operation_id");

-- CreateIndex
CREATE INDEX "hospital_idempotency_records_operation_id_idx" ON "hospital_idempotency_records"("operation_id");

-- CreateIndex
CREATE INDEX "hospital_idempotency_records_hospital_id_case_id_idx" ON "hospital_idempotency_records"("hospital_id", "case_id");

-- CreateIndex
CREATE INDEX "medical_documents_patientId_idx" ON "medical_documents"("patientId");

-- AddForeignKey
ALTER TABLE "hospital_staff" ADD CONSTRAINT "hospital_staff_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_healthPackId_fkey" FOREIGN KEY ("healthPackId") REFERENCES "health_packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_restrictions" ADD CONSTRAINT "account_restrictions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_restrictions" ADD CONSTRAINT "account_restrictions_revokedBy_fkey" FOREIGN KEY ("revokedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_credential_changes" ADD CONSTRAINT "pending_credential_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_matches" ADD CONSTRAINT "hospital_matches_careSetuHospitalId_fkey" FOREIGN KEY ("careSetuHospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_matches" ADD CONSTRAINT "hospital_matches_governmentRecordId_fkey" FOREIGN KEY ("governmentRecordId") REFERENCES "government_health_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_security_statuses" ADD CONSTRAINT "hospital_security_statuses_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_violations" ADD CONSTRAINT "capture_violations_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_security_appeals" ADD CONSTRAINT "hospital_security_appeals_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secure_view_sessions" ADD CONSTRAINT "secure_view_sessions_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "url_share_tokens" ADD CONSTRAINT "url_share_tokens_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
