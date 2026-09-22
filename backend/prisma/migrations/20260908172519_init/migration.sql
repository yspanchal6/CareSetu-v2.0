-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PATIENT', 'HOSPITAL', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('PENDING', 'MATCHING', 'HOSPITAL_REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmergencySeverity" AS ENUM ('RED', 'ORANGE', 'YELLOW', 'GREEN');

-- CreateEnum
CREATE TYPE "EmergencyType" AS ENUM ('MEDICAL', 'ACCIDENT', 'CARDIAC', 'BREATHING', 'TRAUMA', 'POISONING', 'OTHER');

-- CreateEnum
CREATE TYPE "HospitalRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HealthPackStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "HealthPackShareStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DocumentProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AIIntent" AS ENUM ('GENERAL_HEALTH', 'SYMPTOM_CHECK', 'EMERGENCY', 'MEDICATION', 'FIRST_AID', 'HOSPITAL_SEARCH', 'HEALTH_PACK', 'APPOINTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AIRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SafetyDecision" AS ENUM ('NORMAL', 'CAUTION', 'EMERGENCY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SOS', 'HOSPITAL_REQUEST', 'HOSPITAL_ACCEPTED', 'HOSPITAL_REJECTED', 'HEALTH_PACK_SHARED', 'HEALTH_PACK_EXPIRING', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('HEALTH_PACK_SHARE', 'MEDICAL_DATA_ACCESS', 'AI_PROCESSING', 'LOCATION_ACCESS', 'EMERGENCY_DATA_SHARE');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('REGISTER', 'LOGIN', 'LOGOUT', 'PASSWORD_RESET', 'PROFILE_CREATED', 'PROFILE_UPDATED', 'CHAT_STARTED', 'CHAT_MESSAGE', 'AI_ANALYSIS', 'SOS_TRIGGERED', 'EMERGENCY_CREATED', 'EMERGENCY_UPDATED', 'EMERGENCY_CLOSED', 'HOSPITAL_MATCHING', 'HOSPITAL_REQUESTED', 'HOSPITAL_ACCEPTED', 'HOSPITAL_REJECTED', 'HEALTH_PACK_CREATED', 'HEALTH_PACK_UPDATED', 'HEALTH_PACK_SHARED', 'HEALTH_PACK_VIEWED', 'HEALTH_PACK_REVOKED', 'DOCUMENT_UPLOADED', 'DOCUMENT_PROCESSED', 'CONSENT_GRANTED', 'CONSENT_REVOKED', 'ADMIN_ACTION', 'DATA_ACCESS', 'DATA_EXPORT', 'SECURITY_EVENT');

-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('GPS', 'MANUAL', 'NETWORK', 'CACHED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PATIENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "bloodGroup" TEXT,
    "allergies" TEXT,
    "medicalConditions" TEXT,
    "medications" TEXT,
    "emergencyContacts" JSONB,
    "location" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_locations" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "source" "LocationSource" NOT NULL DEFAULT 'GPS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT,
    "state" TEXT,
    "capabilities" TEXT[],
    "emergencyAvailable" BOOLEAN NOT NULL DEFAULT true,
    "location" JSONB NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "hasEmergencyDepartment" BOOLEAN NOT NULL DEFAULT true,
    "hasICU" BOOLEAN NOT NULL DEFAULT false,
    "hasTraumaUnit" BOOLEAN NOT NULL DEFAULT false,
    "hasCardiology" BOOLEAN NOT NULL DEFAULT false,
    "hasNeurology" BOOLEAN NOT NULL DEFAULT false,
    "hasAmbulance" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "intent" "AIIntent",
    "riskLevel" "AIRiskLevel" NOT NULL DEFAULT 'UNKNOWN',
    "safetyDecision" "SafetyDecision" NOT NULL DEFAULT 'UNKNOWN',
    "symptoms" TEXT[],
    "detectedWords" TEXT[],
    "emergencySignals" TEXT[],
    "extractedEntities" JSONB,
    "ragUsed" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "modelName" TEXT,
    "processingTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT,
    "category" TEXT,
    "content" TEXT NOT NULL,
    "version" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB,
    "chunkIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_cases" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "patientId" TEXT NOT NULL,
    "hospitalId" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'PENDING',
    "severity" "EmergencySeverity",
    "emergencyType" "EmergencyType" NOT NULL DEFAULT 'MEDICAL',
    "symptoms" TEXT NOT NULL,
    "location" JSONB NOT NULL,
    "detectedWords" TEXT[],
    "aiRiskLevel" TEXT,
    "aiEmergencySignal" BOOLEAN NOT NULL DEFAULT false,
    "aiReason" TEXT,
    "source" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
    "acceptedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_requests" (
    "id" TEXT NOT NULL,
    "emergencyCaseId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "status" "HospitalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "distanceKm" DOUBLE PRECISION,
    "capabilityMatched" BOOLEAN NOT NULL DEFAULT false,
    "availabilityMatched" BOOLEAN NOT NULL DEFAULT false,
    "matchScore" DOUBLE PRECISION,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_packs" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encryptedData" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "status" "HealthPackStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_pack_shares" (
    "id" TEXT NOT NULL,
    "healthPackId" TEXT NOT NULL,
    "sharedWithUserId" TEXT,
    "sharedWithHospitalId" TEXT,
    "status" "HealthPackShareStatus" NOT NULL DEFAULT 'ACTIVE',
    "consentGranted" BOOLEAN NOT NULL DEFAULT false,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "health_pack_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_documents" (
    "id" TEXT NOT NULL,
    "healthPackId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "processingStatus" "DocumentProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "extractedText" TEXT,
    "extractedConditions" TEXT,
    "extractedMedications" TEXT,
    "extractedAllergies" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'GRANTED',
    "purpose" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "endpoint" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "patients_userId_key" ON "patients"("userId");

-- CreateIndex
CREATE INDEX "patients_userId_idx" ON "patients"("userId");

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients"("phone");

-- CreateIndex
CREATE INDEX "patient_locations_patientId_idx" ON "patient_locations"("patientId");

-- CreateIndex
CREATE INDEX "patient_locations_createdAt_idx" ON "patient_locations"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_userId_key" ON "hospitals"("userId");

-- CreateIndex
CREATE INDEX "hospitals_userId_idx" ON "hospitals"("userId");

-- CreateIndex
CREATE INDEX "hospitals_emergencyAvailable_idx" ON "hospitals"("emergencyAvailable");

-- CreateIndex
CREATE INDEX "hospitals_isVerified_idx" ON "hospitals"("isVerified");

-- CreateIndex
CREATE INDEX "conversations_userId_idx" ON "conversations"("userId");

-- CreateIndex
CREATE INDEX "conversations_status_idx" ON "conversations"("status");

-- CreateIndex
CREATE INDEX "conversations_createdAt_idx" ON "conversations"("createdAt");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_idx" ON "ai_messages"("conversationId");

-- CreateIndex
CREATE INDEX "ai_messages_createdAt_idx" ON "ai_messages"("createdAt");

-- CreateIndex
CREATE INDEX "ai_analyses_conversationId_idx" ON "ai_analyses"("conversationId");

-- CreateIndex
CREATE INDEX "ai_analyses_riskLevel_idx" ON "ai_analyses"("riskLevel");

-- CreateIndex
CREATE INDEX "ai_analyses_safetyDecision_idx" ON "ai_analyses"("safetyDecision");

-- CreateIndex
CREATE INDEX "ai_analyses_createdAt_idx" ON "ai_analyses"("createdAt");

-- CreateIndex
CREATE INDEX "knowledge_documents_category_idx" ON "knowledge_documents"("category");

-- CreateIndex
CREATE INDEX "knowledge_documents_isApproved_idx" ON "knowledge_documents"("isApproved");

-- CreateIndex
CREATE INDEX "knowledge_chunks_documentId_idx" ON "knowledge_chunks"("documentId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_chunkIndex_idx" ON "knowledge_chunks"("chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_cases_caseId_key" ON "emergency_cases"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_cases_idempotencyKey_key" ON "emergency_cases"("idempotencyKey");

-- CreateIndex
CREATE INDEX "emergency_cases_caseId_idx" ON "emergency_cases"("caseId");

-- CreateIndex
CREATE INDEX "emergency_cases_patientId_idx" ON "emergency_cases"("patientId");

-- CreateIndex
CREATE INDEX "emergency_cases_hospitalId_idx" ON "emergency_cases"("hospitalId");

-- CreateIndex
CREATE INDEX "emergency_cases_status_idx" ON "emergency_cases"("status");

-- CreateIndex
CREATE INDEX "emergency_cases_severity_idx" ON "emergency_cases"("severity");

-- CreateIndex
CREATE INDEX "emergency_cases_emergencyType_idx" ON "emergency_cases"("emergencyType");

-- CreateIndex
CREATE INDEX "emergency_cases_createdAt_idx" ON "emergency_cases"("createdAt");

-- CreateIndex
CREATE INDEX "hospital_requests_emergencyCaseId_idx" ON "hospital_requests"("emergencyCaseId");

-- CreateIndex
CREATE INDEX "hospital_requests_hospitalId_idx" ON "hospital_requests"("hospitalId");

-- CreateIndex
CREATE INDEX "hospital_requests_status_idx" ON "hospital_requests"("status");

-- CreateIndex
CREATE INDEX "hospital_requests_requestedAt_idx" ON "hospital_requests"("requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_requests_emergencyCaseId_hospitalId_key" ON "hospital_requests"("emergencyCaseId", "hospitalId");

-- CreateIndex
CREATE INDEX "health_packs_patientId_idx" ON "health_packs"("patientId");

-- CreateIndex
CREATE INDEX "health_packs_status_idx" ON "health_packs"("status");

-- CreateIndex
CREATE INDEX "health_packs_expiresAt_idx" ON "health_packs"("expiresAt");

-- CreateIndex
CREATE INDEX "health_pack_shares_healthPackId_idx" ON "health_pack_shares"("healthPackId");

-- CreateIndex
CREATE INDEX "health_pack_shares_sharedWithUserId_idx" ON "health_pack_shares"("sharedWithUserId");

-- CreateIndex
CREATE INDEX "health_pack_shares_sharedWithHospitalId_idx" ON "health_pack_shares"("sharedWithHospitalId");

-- CreateIndex
CREATE INDEX "health_pack_shares_status_idx" ON "health_pack_shares"("status");

-- CreateIndex
CREATE INDEX "medical_documents_healthPackId_idx" ON "medical_documents"("healthPackId");

-- CreateIndex
CREATE INDEX "medical_documents_processingStatus_idx" ON "medical_documents"("processingStatus");

-- CreateIndex
CREATE INDEX "consents_userId_idx" ON "consents"("userId");

-- CreateIndex
CREATE INDEX "consents_type_idx" ON "consents"("type");

-- CreateIndex
CREATE INDEX "consents_status_idx" ON "consents"("status");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_locations" ADD CONSTRAINT "patient_locations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_requests" ADD CONSTRAINT "hospital_requests_emergencyCaseId_fkey" FOREIGN KEY ("emergencyCaseId") REFERENCES "emergency_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_requests" ADD CONSTRAINT "hospital_requests_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_packs" ADD CONSTRAINT "health_packs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_pack_shares" ADD CONSTRAINT "health_pack_shares_healthPackId_fkey" FOREIGN KEY ("healthPackId") REFERENCES "health_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_healthPackId_fkey" FOREIGN KEY ("healthPackId") REFERENCES "health_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
