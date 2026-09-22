--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4 (Debian 16.4-1.pgdg110+2)
-- Dumped by pg_dump version 16.4 (Debian 16.4-1.pgdg110+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: tiger; Type: SCHEMA; Schema: -; Owner: caresetu
--

CREATE SCHEMA tiger;


ALTER SCHEMA tiger OWNER TO caresetu;

--
-- Name: tiger_data; Type: SCHEMA; Schema: -; Owner: caresetu
--

CREATE SCHEMA tiger_data;


ALTER SCHEMA tiger_data OWNER TO caresetu;

--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: caresetu
--

CREATE SCHEMA topology;


ALTER SCHEMA topology OWNER TO caresetu;

--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: caresetu
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: fuzzystrmatch; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;


--
-- Name: EXTENSION fuzzystrmatch; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION fuzzystrmatch IS 'determine similarities and distance between strings';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: postgis_tiger_geocoder; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder WITH SCHEMA tiger;


--
-- Name: EXTENSION postgis_tiger_geocoder; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_tiger_geocoder IS 'PostGIS tiger geocoder and reverse geocoder';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


--
-- Name: AIIntent; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."AIIntent" AS ENUM (
    'GENERAL_HEALTH',
    'SYMPTOM_CHECK',
    'EMERGENCY',
    'MEDICATION',
    'FIRST_AID',
    'HOSPITAL_SEARCH',
    'HEALTH_PACK',
    'APPOINTMENT',
    'OTHER'
);


ALTER TYPE public."AIIntent" OWNER TO caresetu;

--
-- Name: AIRiskLevel; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."AIRiskLevel" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL',
    'UNKNOWN'
);


ALTER TYPE public."AIRiskLevel" OWNER TO caresetu;

--
-- Name: AuditAction; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."AuditAction" AS ENUM (
    'REGISTER',
    'LOGIN',
    'LOGOUT',
    'PASSWORD_RESET',
    'PROFILE_CREATED',
    'PROFILE_UPDATED',
    'CHAT_STARTED',
    'CHAT_MESSAGE',
    'AI_ANALYSIS',
    'SOS_TRIGGERED',
    'EMERGENCY_CREATED',
    'EMERGENCY_UPDATED',
    'EMERGENCY_CLOSED',
    'HOSPITAL_MATCHING',
    'HOSPITAL_REQUESTED',
    'HOSPITAL_ACCEPTED',
    'HOSPITAL_REJECTED',
    'HEALTH_PACK_CREATED',
    'HEALTH_PACK_UPDATED',
    'HEALTH_PACK_SHARED',
    'HEALTH_PACK_VIEWED',
    'HEALTH_PACK_REVOKED',
    'DOCUMENT_UPLOADED',
    'DOCUMENT_PROCESSED',
    'CONSENT_GRANTED',
    'CONSENT_REVOKED',
    'ADMIN_ACTION',
    'DATA_ACCESS',
    'DATA_EXPORT',
    'SECURITY_EVENT'
);


ALTER TYPE public."AuditAction" OWNER TO caresetu;

--
-- Name: CaseStatus; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."CaseStatus" AS ENUM (
    'PENDING',
    'MATCHING',
    'HOSPITAL_REQUESTED',
    'ACCEPTED',
    'IN_PROGRESS',
    'CLOSED',
    'CANCELLED'
);


ALTER TYPE public."CaseStatus" OWNER TO caresetu;

--
-- Name: ConsentStatus; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."ConsentStatus" AS ENUM (
    'GRANTED',
    'REVOKED',
    'EXPIRED'
);


ALTER TYPE public."ConsentStatus" OWNER TO caresetu;

--
-- Name: ConsentType; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."ConsentType" AS ENUM (
    'HEALTH_PACK_SHARE',
    'MEDICAL_DATA_ACCESS',
    'AI_PROCESSING',
    'LOCATION_ACCESS',
    'EMERGENCY_DATA_SHARE'
);


ALTER TYPE public."ConsentType" OWNER TO caresetu;

--
-- Name: ConversationStatus; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."ConversationStatus" AS ENUM (
    'ACTIVE',
    'CLOSED',
    'ARCHIVED'
);


ALTER TYPE public."ConversationStatus" OWNER TO caresetu;

--
-- Name: DocumentProcessingStatus; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."DocumentProcessingStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);


ALTER TYPE public."DocumentProcessingStatus" OWNER TO caresetu;

--
-- Name: EmergencySeverity; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."EmergencySeverity" AS ENUM (
    'RED',
    'ORANGE',
    'YELLOW',
    'GREEN'
);


ALTER TYPE public."EmergencySeverity" OWNER TO caresetu;

--
-- Name: EmergencyType; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."EmergencyType" AS ENUM (
    'MEDICAL',
    'ACCIDENT',
    'CARDIAC',
    'BREATHING',
    'TRAUMA',
    'POISONING',
    'OTHER'
);


ALTER TYPE public."EmergencyType" OWNER TO caresetu;

--
-- Name: HealthPackShareStatus; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."HealthPackShareStatus" AS ENUM (
    'ACTIVE',
    'REVOKED',
    'EXPIRED'
);


ALTER TYPE public."HealthPackShareStatus" OWNER TO caresetu;

--
-- Name: HealthPackStatus; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."HealthPackStatus" AS ENUM (
    'ACTIVE',
    'ARCHIVED',
    'EXPIRED'
);


ALTER TYPE public."HealthPackStatus" OWNER TO caresetu;

--
-- Name: HospitalRequestStatus; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."HospitalRequestStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED'
);


ALTER TYPE public."HospitalRequestStatus" OWNER TO caresetu;

--
-- Name: LocationSource; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."LocationSource" AS ENUM (
    'GPS',
    'MANUAL',
    'NETWORK',
    'CACHED'
);


ALTER TYPE public."LocationSource" OWNER TO caresetu;

--
-- Name: MessageRole; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."MessageRole" AS ENUM (
    'USER',
    'ASSISTANT',
    'SYSTEM'
);


ALTER TYPE public."MessageRole" OWNER TO caresetu;

--
-- Name: NotificationStatus; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."NotificationStatus" AS ENUM (
    'UNREAD',
    'READ',
    'EXPIRED'
);


ALTER TYPE public."NotificationStatus" OWNER TO caresetu;

--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."NotificationType" AS ENUM (
    'SOS',
    'HOSPITAL_REQUEST',
    'HOSPITAL_ACCEPTED',
    'HOSPITAL_REJECTED',
    'HEALTH_PACK_SHARED',
    'HEALTH_PACK_EXPIRING',
    'SYSTEM'
);


ALTER TYPE public."NotificationType" OWNER TO caresetu;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."Role" AS ENUM (
    'PATIENT',
    'HOSPITAL',
    'ADMIN',
    'DOCTOR'
);


ALTER TYPE public."Role" OWNER TO caresetu;

--
-- Name: SafetyDecision; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."SafetyDecision" AS ENUM (
    'NORMAL',
    'CAUTION',
    'EMERGENCY',
    'UNKNOWN'
);


ALTER TYPE public."SafetyDecision" OWNER TO caresetu;

--
-- Name: SyncStatus; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."SyncStatus" AS ENUM (
    'PENDING',
    'SYNCED',
    'FAILED'
);


ALTER TYPE public."SyncStatus" OWNER TO caresetu;

--
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: caresetu
--

CREATE TYPE public."UserStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'BLOCKED',
    'PENDING'
);


ALTER TYPE public."UserStatus" OWNER TO caresetu;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO caresetu;

--
-- Name: ai_analyses; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.ai_analyses (
    id text NOT NULL,
    "conversationId" text NOT NULL,
    intent public."AIIntent",
    "riskLevel" public."AIRiskLevel" DEFAULT 'UNKNOWN'::public."AIRiskLevel" NOT NULL,
    "safetyDecision" public."SafetyDecision" DEFAULT 'UNKNOWN'::public."SafetyDecision" NOT NULL,
    symptoms text[],
    "detectedWords" text[],
    "emergencySignals" text[],
    "extractedEntities" jsonb,
    "ragUsed" boolean DEFAULT false NOT NULL,
    confidence double precision,
    "modelName" text,
    "processingTimeMs" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.ai_analyses OWNER TO caresetu;

--
-- Name: ai_messages; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.ai_messages (
    id text NOT NULL,
    "conversationId" text NOT NULL,
    role public."MessageRole" NOT NULL,
    content text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.ai_messages OWNER TO caresetu;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "userId" text,
    action public."AuditAction" NOT NULL,
    entity text,
    "entityId" text,
    endpoint text,
    "ipAddress" text,
    "userAgent" text,
    details jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO caresetu;

--
-- Name: consents; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.consents (
    id text NOT NULL,
    "userId" text NOT NULL,
    type public."ConsentType" NOT NULL,
    status public."ConsentStatus" DEFAULT 'GRANTED'::public."ConsentStatus" NOT NULL,
    purpose text,
    "grantedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone
);


ALTER TABLE public.consents OWNER TO caresetu;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.conversations (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text,
    status public."ConversationStatus" DEFAULT 'ACTIVE'::public."ConversationStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.conversations OWNER TO caresetu;

--
-- Name: emergency_cases; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.emergency_cases (
    id text NOT NULL,
    "caseId" text NOT NULL,
    "idempotencyKey" text,
    "patientId" text NOT NULL,
    "hospitalId" text,
    status public."CaseStatus" DEFAULT 'PENDING'::public."CaseStatus" NOT NULL,
    severity public."EmergencySeverity",
    "emergencyType" public."EmergencyType" DEFAULT 'MEDICAL'::public."EmergencyType" NOT NULL,
    symptoms text NOT NULL,
    location jsonb NOT NULL,
    "detectedWords" text[],
    "aiRiskLevel" text,
    "aiEmergencySignal" boolean DEFAULT false NOT NULL,
    "aiReason" text,
    source text,
    "syncStatus" public."SyncStatus" DEFAULT 'SYNCED'::public."SyncStatus" NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "closedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.emergency_cases OWNER TO caresetu;

--
-- Name: health_pack_shares; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.health_pack_shares (
    id text NOT NULL,
    "healthPackId" text NOT NULL,
    "sharedWithUserId" text,
    "sharedWithHospitalId" text,
    status public."HealthPackShareStatus" DEFAULT 'ACTIVE'::public."HealthPackShareStatus" NOT NULL,
    "consentGranted" boolean DEFAULT false NOT NULL,
    "sharedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "revokedAt" timestamp(3) without time zone
);


ALTER TABLE public.health_pack_shares OWNER TO caresetu;

--
-- Name: health_packs; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.health_packs (
    id text NOT NULL,
    "patientId" text NOT NULL,
    "encryptedData" text NOT NULL,
    iv text NOT NULL,
    status public."HealthPackStatus" DEFAULT 'ACTIVE'::public."HealthPackStatus" NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.health_packs OWNER TO caresetu;

--
-- Name: hospital_requests; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.hospital_requests (
    id text NOT NULL,
    "emergencyCaseId" text NOT NULL,
    "hospitalId" text NOT NULL,
    status public."HospitalRequestStatus" DEFAULT 'PENDING'::public."HospitalRequestStatus" NOT NULL,
    "distanceKm" double precision,
    "capabilityMatched" boolean DEFAULT false NOT NULL,
    "availabilityMatched" boolean DEFAULT false NOT NULL,
    "matchScore" double precision,
    "requestedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "respondedAt" timestamp(3) without time zone,
    "rejectionReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.hospital_requests OWNER TO caresetu;

--
-- Name: hospitals; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.hospitals (
    id text NOT NULL,
    "userId" text NOT NULL,
    name text NOT NULL,
    address text NOT NULL,
    phone text NOT NULL,
    email text,
    city text,
    state text,
    capabilities text[],
    "emergencyAvailable" boolean DEFAULT true NOT NULL,
    location jsonb NOT NULL,
    "isVerified" boolean DEFAULT false NOT NULL,
    "hasEmergencyDepartment" boolean DEFAULT true NOT NULL,
    "hasICU" boolean DEFAULT false NOT NULL,
    "hasTraumaUnit" boolean DEFAULT false NOT NULL,
    "hasCardiology" boolean DEFAULT false NOT NULL,
    "hasNeurology" boolean DEFAULT false NOT NULL,
    "hasAmbulance" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.hospitals OWNER TO caresetu;

--
-- Name: knowledge_chunks; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.knowledge_chunks (
    id text NOT NULL,
    "documentId" text NOT NULL,
    content text NOT NULL,
    embedding jsonb,
    "chunkIndex" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.knowledge_chunks OWNER TO caresetu;

--
-- Name: knowledge_documents; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.knowledge_documents (
    id text NOT NULL,
    title text NOT NULL,
    source text,
    category text,
    content text NOT NULL,
    version text,
    "isApproved" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.knowledge_documents OWNER TO caresetu;

--
-- Name: medical_documents; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.medical_documents (
    id text NOT NULL,
    "healthPackId" text NOT NULL,
    "fileName" text NOT NULL,
    "fileUrl" text NOT NULL,
    "fileType" text,
    "fileSize" integer,
    "processingStatus" public."DocumentProcessingStatus" DEFAULT 'PENDING'::public."DocumentProcessingStatus" NOT NULL,
    "extractedText" text,
    "extractedConditions" text,
    "extractedMedications" text,
    "extractedAllergies" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.medical_documents OWNER TO caresetu;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    "userId" text NOT NULL,
    type public."NotificationType" NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    status public."NotificationStatus" DEFAULT 'UNREAD'::public."NotificationStatus" NOT NULL,
    data jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "readAt" timestamp(3) without time zone
);


ALTER TABLE public.notifications OWNER TO caresetu;

--
-- Name: patient_locations; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.patient_locations (
    id text NOT NULL,
    "patientId" text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    accuracy double precision,
    source public."LocationSource" DEFAULT 'GPS'::public."LocationSource" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.patient_locations OWNER TO caresetu;

--
-- Name: patients; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.patients (
    id text NOT NULL,
    "userId" text NOT NULL,
    name text NOT NULL,
    age integer NOT NULL,
    gender text NOT NULL,
    phone text NOT NULL,
    "bloodGroup" text,
    allergies text,
    "medicalConditions" text,
    medications text,
    "emergencyContacts" jsonb,
    location jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.patients OWNER TO caresetu;

--
-- Name: users; Type: TABLE; Schema: public; Owner: caresetu
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role public."Role" DEFAULT 'PATIENT'::public."Role" NOT NULL,
    status public."UserStatus" DEFAULT 'ACTIVE'::public."UserStatus" NOT NULL,
    "isVerified" boolean DEFAULT false NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    name text
);


ALTER TABLE public.users OWNER TO caresetu;

--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: ai_analyses ai_analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.ai_analyses
    ADD CONSTRAINT ai_analyses_pkey PRIMARY KEY (id);


--
-- Name: ai_messages ai_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: consents consents_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.consents
    ADD CONSTRAINT consents_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: emergency_cases emergency_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT emergency_cases_pkey PRIMARY KEY (id);


--
-- Name: health_pack_shares health_pack_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.health_pack_shares
    ADD CONSTRAINT health_pack_shares_pkey PRIMARY KEY (id);


--
-- Name: health_packs health_packs_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.health_packs
    ADD CONSTRAINT health_packs_pkey PRIMARY KEY (id);


--
-- Name: hospital_requests hospital_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.hospital_requests
    ADD CONSTRAINT hospital_requests_pkey PRIMARY KEY (id);


--
-- Name: hospitals hospitals_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_pkey PRIMARY KEY (id);


--
-- Name: knowledge_chunks knowledge_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_pkey PRIMARY KEY (id);


--
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: medical_documents medical_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.medical_documents
    ADD CONSTRAINT medical_documents_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: patient_locations patient_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.patient_locations
    ADD CONSTRAINT patient_locations_pkey PRIMARY KEY (id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ai_analyses_conversationId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "ai_analyses_conversationId_idx" ON public.ai_analyses USING btree ("conversationId");


--
-- Name: ai_analyses_createdAt_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "ai_analyses_createdAt_idx" ON public.ai_analyses USING btree ("createdAt");


--
-- Name: ai_analyses_riskLevel_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "ai_analyses_riskLevel_idx" ON public.ai_analyses USING btree ("riskLevel");


--
-- Name: ai_analyses_safetyDecision_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "ai_analyses_safetyDecision_idx" ON public.ai_analyses USING btree ("safetyDecision");


--
-- Name: ai_messages_conversationId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "ai_messages_conversationId_idx" ON public.ai_messages USING btree ("conversationId");


--
-- Name: ai_messages_createdAt_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "ai_messages_createdAt_idx" ON public.ai_messages USING btree ("createdAt");


--
-- Name: audit_logs_action_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_createdAt_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "audit_logs_createdAt_idx" ON public.audit_logs USING btree ("createdAt");


--
-- Name: audit_logs_entity_entityId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "audit_logs_entity_entityId_idx" ON public.audit_logs USING btree (entity, "entityId");


--
-- Name: audit_logs_userId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "audit_logs_userId_idx" ON public.audit_logs USING btree ("userId");


--
-- Name: consents_status_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX consents_status_idx ON public.consents USING btree (status);


--
-- Name: consents_type_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX consents_type_idx ON public.consents USING btree (type);


--
-- Name: consents_userId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "consents_userId_idx" ON public.consents USING btree ("userId");


--
-- Name: conversations_createdAt_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "conversations_createdAt_idx" ON public.conversations USING btree ("createdAt");


--
-- Name: conversations_status_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX conversations_status_idx ON public.conversations USING btree (status);


--
-- Name: conversations_userId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "conversations_userId_idx" ON public.conversations USING btree ("userId");


--
-- Name: emergency_cases_caseId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "emergency_cases_caseId_idx" ON public.emergency_cases USING btree ("caseId");


--
-- Name: emergency_cases_caseId_key; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE UNIQUE INDEX "emergency_cases_caseId_key" ON public.emergency_cases USING btree ("caseId");


--
-- Name: emergency_cases_createdAt_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "emergency_cases_createdAt_idx" ON public.emergency_cases USING btree ("createdAt");


--
-- Name: emergency_cases_emergencyType_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "emergency_cases_emergencyType_idx" ON public.emergency_cases USING btree ("emergencyType");


--
-- Name: emergency_cases_hospitalId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "emergency_cases_hospitalId_idx" ON public.emergency_cases USING btree ("hospitalId");


--
-- Name: emergency_cases_idempotencyKey_key; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE UNIQUE INDEX "emergency_cases_idempotencyKey_key" ON public.emergency_cases USING btree ("idempotencyKey");


--
-- Name: emergency_cases_patientId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "emergency_cases_patientId_idx" ON public.emergency_cases USING btree ("patientId");


--
-- Name: emergency_cases_severity_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX emergency_cases_severity_idx ON public.emergency_cases USING btree (severity);


--
-- Name: emergency_cases_status_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX emergency_cases_status_idx ON public.emergency_cases USING btree (status);


--
-- Name: health_pack_shares_healthPackId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "health_pack_shares_healthPackId_idx" ON public.health_pack_shares USING btree ("healthPackId");


--
-- Name: health_pack_shares_sharedWithHospitalId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "health_pack_shares_sharedWithHospitalId_idx" ON public.health_pack_shares USING btree ("sharedWithHospitalId");


--
-- Name: health_pack_shares_sharedWithUserId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "health_pack_shares_sharedWithUserId_idx" ON public.health_pack_shares USING btree ("sharedWithUserId");


--
-- Name: health_pack_shares_status_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX health_pack_shares_status_idx ON public.health_pack_shares USING btree (status);


--
-- Name: health_packs_expiresAt_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "health_packs_expiresAt_idx" ON public.health_packs USING btree ("expiresAt");


--
-- Name: health_packs_patientId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "health_packs_patientId_idx" ON public.health_packs USING btree ("patientId");


--
-- Name: health_packs_status_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX health_packs_status_idx ON public.health_packs USING btree (status);


--
-- Name: hospital_requests_emergencyCaseId_hospitalId_key; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE UNIQUE INDEX "hospital_requests_emergencyCaseId_hospitalId_key" ON public.hospital_requests USING btree ("emergencyCaseId", "hospitalId");


--
-- Name: hospital_requests_emergencyCaseId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "hospital_requests_emergencyCaseId_idx" ON public.hospital_requests USING btree ("emergencyCaseId");


--
-- Name: hospital_requests_hospitalId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "hospital_requests_hospitalId_idx" ON public.hospital_requests USING btree ("hospitalId");


--
-- Name: hospital_requests_requestedAt_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "hospital_requests_requestedAt_idx" ON public.hospital_requests USING btree ("requestedAt");


--
-- Name: hospital_requests_status_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX hospital_requests_status_idx ON public.hospital_requests USING btree (status);


--
-- Name: hospitals_emergencyAvailable_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "hospitals_emergencyAvailable_idx" ON public.hospitals USING btree ("emergencyAvailable");


--
-- Name: hospitals_isVerified_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "hospitals_isVerified_idx" ON public.hospitals USING btree ("isVerified");


--
-- Name: hospitals_userId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "hospitals_userId_idx" ON public.hospitals USING btree ("userId");


--
-- Name: hospitals_userId_key; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE UNIQUE INDEX "hospitals_userId_key" ON public.hospitals USING btree ("userId");


--
-- Name: knowledge_chunks_chunkIndex_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "knowledge_chunks_chunkIndex_idx" ON public.knowledge_chunks USING btree ("chunkIndex");


--
-- Name: knowledge_chunks_documentId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "knowledge_chunks_documentId_idx" ON public.knowledge_chunks USING btree ("documentId");


--
-- Name: knowledge_documents_category_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX knowledge_documents_category_idx ON public.knowledge_documents USING btree (category);


--
-- Name: knowledge_documents_isApproved_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "knowledge_documents_isApproved_idx" ON public.knowledge_documents USING btree ("isApproved");


--
-- Name: medical_documents_healthPackId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "medical_documents_healthPackId_idx" ON public.medical_documents USING btree ("healthPackId");


--
-- Name: medical_documents_processingStatus_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "medical_documents_processingStatus_idx" ON public.medical_documents USING btree ("processingStatus");


--
-- Name: notifications_createdAt_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "notifications_createdAt_idx" ON public.notifications USING btree ("createdAt");


--
-- Name: notifications_status_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX notifications_status_idx ON public.notifications USING btree (status);


--
-- Name: notifications_userId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "notifications_userId_idx" ON public.notifications USING btree ("userId");


--
-- Name: patient_locations_createdAt_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "patient_locations_createdAt_idx" ON public.patient_locations USING btree ("createdAt");


--
-- Name: patient_locations_patientId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "patient_locations_patientId_idx" ON public.patient_locations USING btree ("patientId");


--
-- Name: patients_phone_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX patients_phone_idx ON public.patients USING btree (phone);


--
-- Name: patients_userId_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX "patients_userId_idx" ON public.patients USING btree ("userId");


--
-- Name: patients_userId_key; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE UNIQUE INDEX "patients_userId_key" ON public.patients USING btree ("userId");


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX users_role_idx ON public.users USING btree (role);


--
-- Name: users_status_idx; Type: INDEX; Schema: public; Owner: caresetu
--

CREATE INDEX users_status_idx ON public.users USING btree (status);


--
-- Name: ai_analyses ai_analyses_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.ai_analyses
    ADD CONSTRAINT "ai_analyses_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public.conversations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ai_messages ai_messages_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public.conversations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: consents consents_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.consents
    ADD CONSTRAINT "consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: conversations conversations_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: emergency_cases emergency_cases_hospitalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT "emergency_cases_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES public.hospitals(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: emergency_cases emergency_cases_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT "emergency_cases_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: health_pack_shares health_pack_shares_healthPackId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.health_pack_shares
    ADD CONSTRAINT "health_pack_shares_healthPackId_fkey" FOREIGN KEY ("healthPackId") REFERENCES public.health_packs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: health_packs health_packs_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.health_packs
    ADD CONSTRAINT "health_packs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hospital_requests hospital_requests_emergencyCaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.hospital_requests
    ADD CONSTRAINT "hospital_requests_emergencyCaseId_fkey" FOREIGN KEY ("emergencyCaseId") REFERENCES public.emergency_cases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hospital_requests hospital_requests_hospitalId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.hospital_requests
    ADD CONSTRAINT "hospital_requests_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES public.hospitals(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: hospitals hospitals_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT "hospitals_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: knowledge_chunks knowledge_chunks_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT "knowledge_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public.knowledge_documents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: medical_documents medical_documents_healthPackId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.medical_documents
    ADD CONSTRAINT "medical_documents_healthPackId_fkey" FOREIGN KEY ("healthPackId") REFERENCES public.health_packs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: patient_locations patient_locations_patientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.patient_locations
    ADD CONSTRAINT "patient_locations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES public.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: patients patients_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: caresetu
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT "patients_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

