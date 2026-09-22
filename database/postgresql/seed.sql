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
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
bab14d99-4443-4e01-a27c-626d530d56a2	14d1b8bed67b6c9739bc63bfc87507d62cddb1732291c355a2122dcfa3a2ba8d	2026-09-08 17:25:20.48009+00	20260908172519_init	\N	\N	2026-09-08 17:25:19.741074+00	1
6c310c95-fd8d-482c-8481-32215c821ccc	efdfd2671e55508ec4a4051162484ccba35185af9ac7e2f8c0fb2c9514b2bf58	2026-09-09 17:46:15.609722+00	202609090001_add_doctor_role	\N	\N	2026-09-09 17:46:15.551024+00	1
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.users (id, email, password, role, status, "isVerified", "lastLoginAt", "createdAt", "updatedAt", name) FROM stdin;
787b5fc9-f5fd-44b3-a5f9-94bad1ed9ee6	patient@caresetu.com	$2b$10$XGmDTZK9ukw2q.Imi3zxG.uRCja7zNydGBqFHk2518qBTBIBm100a	PATIENT	ACTIVE	f	\N	2026-09-09 18:20:24.468	2026-09-09 18:20:24.468	John Patient
7c07b141-4a7c-4981-985b-73d0006bfb6a	sal@caresetu.com	$2b$10$XGmDTZK9ukw2q.Imi3zxG.uRCja7zNydGBqFHk2518qBTBIBm100a	HOSPITAL	ACTIVE	f	\N	2026-09-09 18:20:24.548	2026-09-09 18:20:24.548	SAL Hospital
882b3f09-7c58-41d4-b342-c22032ea741b	zydus@caresetu.com	$2b$10$XGmDTZK9ukw2q.Imi3zxG.uRCja7zNydGBqFHk2518qBTBIBm100a	HOSPITAL	ACTIVE	f	\N	2026-09-09 18:20:24.563	2026-09-09 18:20:24.563	Zydus Hospital
90281c6d-5cf1-4637-9938-6e9e410afde8	hospC@caresetu.com	$2b$10$XGmDTZK9ukw2q.Imi3zxG.uRCja7zNydGBqFHk2518qBTBIBm100a	HOSPITAL	ACTIVE	f	\N	2026-09-09 18:20:24.574	2026-09-09 18:20:24.574	Hospital C
6965791f-c3d1-4aa5-b3aa-801a96d307bf	admin@caresetu.com	$2b$10$XGmDTZK9ukw2q.Imi3zxG.uRCja7zNydGBqFHk2518qBTBIBm100a	ADMIN	ACTIVE	f	\N	2026-09-09 18:20:24.584	2026-09-09 18:20:24.584	Admin
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.conversations (id, "userId", title, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ai_analyses; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.ai_analyses (id, "conversationId", intent, "riskLevel", "safetyDecision", symptoms, "detectedWords", "emergencySignals", "extractedEntities", "ragUsed", confidence, "modelName", "processingTimeMs", "createdAt") FROM stdin;
\.


--
-- Data for Name: ai_messages; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.ai_messages (id, "conversationId", role, content, "createdAt") FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.audit_logs (id, "userId", action, entity, "entityId", endpoint, "ipAddress", "userAgent", details, "createdAt") FROM stdin;
af96a0a1-9fdc-4675-b83d-0c01c2755965	787b5fc9-f5fd-44b3-a5f9-94bad1ed9ee6	EMERGENCY_CREATED	EmergencyCase	06cec23e-fd44-4a2a-ab46-14d1d0d9e78d	/api/emergency/sos	\N	\N	{"caseId": "CASE-20260909-A69EC2", "severity": "RED", "hospitalsMatched": 2}	2026-09-09 18:23:06.48
f8d999c8-72f9-4b04-a4fb-234c8b0832b4	7c07b141-4a7c-4981-985b-73d0006bfb6a	HOSPITAL_ACCEPTED	\N	\N	\N	\N	\N	"Hospital SAL Hospital accepted case CASE-20260909-A69EC2"	2026-09-09 18:23:06.541
f08079d7-2a64-43b1-b6cd-2ad9547b9184	787b5fc9-f5fd-44b3-a5f9-94bad1ed9ee6	EMERGENCY_CREATED	EmergencyCase	f6340bf9-c85e-4270-8b69-0524f9183e8a	/api/emergency/sos	\N	\N	{"caseId": "CASE-20260909-A5B3B8", "severity": "RED", "hospitalsMatched": 2}	2026-09-09 18:26:18.368
1ac0b3fe-e1c4-44af-b6cf-a5b5dc9a15bd	7c07b141-4a7c-4981-985b-73d0006bfb6a	HOSPITAL_ACCEPTED	\N	\N	\N	\N	\N	"Hospital SAL Hospital accepted case CASE-20260909-A5B3B8"	2026-09-09 18:26:18.495
d9a7804a-80da-473b-9d45-638ed2e5f8d9	7c07b141-4a7c-4981-985b-73d0006bfb6a	HEALTH_PACK_VIEWED	HealthPack	cf4d4f98-b177-4e41-a036-68c8db789162	\N	127.0.0.1	\N	"Hospital successfully accessed encrypted HealthPack"	2026-09-09 18:26:18.573
2498fc9f-036f-4f8f-8fa6-f7349c796ad1	7c07b141-4a7c-4981-985b-73d0006bfb6a	HEALTH_PACK_VIEWED	HealthPack	0a033905-db63-4016-8933-8b0349fecd3a	\N	127.0.0.1	\N	"UNAUTHORIZED ACCESS ATTEMPT: No active consent found"	2026-09-09 18:46:57.968
ace28f36-44ec-44c1-830e-5870bfd3eaaf	7c07b141-4a7c-4981-985b-73d0006bfb6a	HEALTH_PACK_VIEWED	HealthPack	5fc47457-afd6-4f57-8e6a-042ca8edd570	\N	127.0.0.1	\N	"UNAUTHORIZED ACCESS ATTEMPT: No active consent found"	2026-09-09 18:48:18.779
e626e6b6-17eb-4ac9-ac52-694add00114c	7c07b141-4a7c-4981-985b-73d0006bfb6a	HEALTH_PACK_VIEWED	HealthPack	5fc47457-afd6-4f57-8e6a-042ca8edd570	\N	127.0.0.1	\N	"Hospital successfully accessed encrypted HealthPack"	2026-09-09 18:48:18.805
46b84c23-37de-47d8-a5fb-4dabc784e773	7c07b141-4a7c-4981-985b-73d0006bfb6a	HEALTH_PACK_VIEWED	HealthPack	5bdfa707-5df3-4745-835c-5934e935482f	\N	127.0.0.1	\N	"UNAUTHORIZED ACCESS ATTEMPT: No active consent found"	2026-09-09 18:49:03.156
16bff76a-da25-47a5-868e-be465ae651f8	7c07b141-4a7c-4981-985b-73d0006bfb6a	HEALTH_PACK_VIEWED	HealthPack	5bdfa707-5df3-4745-835c-5934e935482f	\N	127.0.0.1	\N	"Hospital successfully accessed encrypted HealthPack"	2026-09-09 18:49:03.191
bd4a7f0e-d8a6-4594-a11b-472de7b7095a	787b5fc9-f5fd-44b3-a5f9-94bad1ed9ee6	EMERGENCY_CREATED	EmergencyCase	a01be286-6291-4006-bb3a-a5a4e5903772	/api/emergency/sos	\N	\N	{"caseId": "CASE-20260909-C1FFC3", "severity": "RED", "hospitalsMatched": 2}	2026-09-09 18:52:00.903
6d9b0684-d57a-4b2b-bd43-4e466cb3ac25	787b5fc9-f5fd-44b3-a5f9-94bad1ed9ee6	EMERGENCY_CREATED	EmergencyCase	9d0686e0-d772-4b76-b611-2d8ca9864645	/api/emergency/sos	\N	\N	{"caseId": "CASE-20260909-E87D54", "severity": "RED", "hospitalsMatched": 2}	2026-09-09 18:53:58.628
61eddeb3-6129-47d9-97bc-f81dc4462476	7c07b141-4a7c-4981-985b-73d0006bfb6a	HOSPITAL_REJECTED	\N	\N	\N	\N	\N	"Hospital SAL Hospital rejected case CASE-20260909-E87D54"	2026-09-09 18:53:58.675
43daf20c-ab8f-415f-b122-cd0ce7924216	90281c6d-5cf1-4637-9938-6e9e410afde8	HOSPITAL_ACCEPTED	\N	\N	\N	\N	\N	"Hospital Hospital C accepted case CASE-20260909-E87D54"	2026-09-09 18:53:58.755
\.


--
-- Data for Name: consents; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.consents (id, "userId", type, status, purpose, "grantedAt", "revokedAt", "expiresAt") FROM stdin;
\.


--
-- Data for Name: hospitals; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.hospitals (id, "userId", name, address, phone, email, city, state, capabilities, "emergencyAvailable", location, "isVerified", "hasEmergencyDepartment", "hasICU", "hasTraumaUnit", "hasCardiology", "hasNeurology", "hasAmbulance", "createdAt", "updatedAt") FROM stdin;
4c3d0517-27f4-4cc3-a6e7-5f2ac057859e	7c07b141-4a7c-4981-985b-73d0006bfb6a	SAL Hospital	2km Away St	111111111	\N	\N	\N	\N	t	{"latitude": 23.03, "longitude": 72.58}	f	t	f	t	t	f	f	2026-09-09 18:20:24.548	2026-09-09 18:20:24.548
3d68cb97-0701-4015-bf0b-320a847865d7	882b3f09-7c58-41d4-b342-c22032ea741b	Zydus Hospital	8km Away St	222222222	\N	\N	\N	\N	t	{"latitude": 23.05, "longitude": 72.59}	f	t	f	f	f	f	f	2026-09-09 18:20:24.563	2026-09-09 18:20:24.563
e8e41d60-fb8e-4c7a-8c1f-5f61fd49bd73	90281c6d-5cf1-4637-9938-6e9e410afde8	Hospital C	20km Away St	333333333	\N	\N	\N	\N	t	{"latitude": 23.1, "longitude": 72.7}	f	t	f	f	t	f	f	2026-09-09 18:20:24.574	2026-09-09 18:20:24.574
\.


--
-- Data for Name: patients; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.patients (id, "userId", name, age, gender, phone, "bloodGroup", allergies, "medicalConditions", medications, "emergencyContacts", location, "createdAt", "updatedAt") FROM stdin;
c155c185-8749-476a-9522-2f43681365e9	787b5fc9-f5fd-44b3-a5f9-94bad1ed9ee6	John Patient	30	M	1234567890	\N	\N	\N	\N	\N	{"latitude": 23.0225, "longitude": 72.5714}	2026-09-09 18:20:24.468	2026-09-09 18:20:24.468
\.


--
-- Data for Name: emergency_cases; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.emergency_cases (id, "caseId", "idempotencyKey", "patientId", "hospitalId", status, severity, "emergencyType", symptoms, location, "detectedWords", "aiRiskLevel", "aiEmergencySignal", "aiReason", source, "syncStatus", "acceptedAt", "closedAt", "createdAt", "updatedAt") FROM stdin;
06cec23e-fd44-4a2a-ab46-14d1d0d9e78d	CASE-20260909-A69EC2	E2E-IDEMP-001	c155c185-8749-476a-9522-2f43681365e9	4c3d0517-27f4-4cc3-a6e7-5f2ac057859e	ACCEPTED	RED	CARDIAC	Severe chest pain, left arm numbness	{"latitude": 23.0225, "longitude": 72.5714}	{"Critical Symptom Matched: chest pain"}	\N	f	Priority: 1, Rule: Critical Symptom Matched: chest pain	PATIENT_APP	SYNCED	2026-09-09 18:23:06.517	\N	2026-09-09 18:23:06.281	2026-09-09 18:23:06.527
f6340bf9-c85e-4270-8b69-0524f9183e8a	CASE-20260909-A5B3B8	E2E-IDEMP-1788978377474	c155c185-8749-476a-9522-2f43681365e9	4c3d0517-27f4-4cc3-a6e7-5f2ac057859e	ACCEPTED	RED	CARDIAC	Severe chest pain, left arm numbness	{"latitude": 23.0225, "longitude": 72.5714}	{"Critical Symptom Matched: chest pain"}	\N	f	Priority: 1, Rule: Critical Symptom Matched: chest pain	PATIENT_APP	SYNCED	2026-09-09 18:26:18.449	\N	2026-09-09 18:26:17.535	2026-09-09 18:26:18.467
a01be286-6291-4006-bb3a-a5a4e5903772	CASE-20260909-C1FFC3	TEST-IDEMP-008	c155c185-8749-476a-9522-2f43681365e9	\N	PENDING	RED	CARDIAC	Chest pain	{"latitude": 23.0225, "longitude": 72.5714}	{"Critical Symptom Matched: chest pain"}	\N	f	Priority: 1, Rule: Critical Symptom Matched: chest pain	PATIENT_APP	SYNCED	\N	\N	2026-09-09 18:52:00.359	2026-09-09 18:52:00.359
9d0686e0-d772-4b76-b611-2d8ca9864645	CASE-20260909-E87D54	TEST-IDEMP-1788980037992	c155c185-8749-476a-9522-2f43681365e9	e8e41d60-fb8e-4c7a-8c1f-5f61fd49bd73	ACCEPTED	RED	CARDIAC	Chest pain	{"latitude": 23.0225, "longitude": 72.5714}	{"Critical Symptom Matched: chest pain"}	\N	f	Priority: 1, Rule: Critical Symptom Matched: chest pain	PATIENT_APP	SYNCED	2026-09-09 18:53:58.727	\N	2026-09-09 18:53:58.033	2026-09-09 18:53:58.739
\.


--
-- Data for Name: health_packs; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.health_packs (id, "patientId", "encryptedData", iv, status, "expiresAt", "createdAt", "updatedAt") FROM stdin;
cf4d4f98-b177-4e41-a036-68c8db789162	c155c185-8749-476a-9522-2f43681365e9	eede85aeb9a505cb864e2368352dd50ce4127a28913a81dd59f80484e0c55d8c82d8708bae1f90c4339064cddf00dfa45c4bbd57da05b33f2b8b4da964a05bd86a4bc96c9cd8719c3d19b343def351484d645a3f6b3eab30210e90a1927388b266f940266f5c18c2a940a6d1454591560b105152985c00e00621d0e6dd886877364301afd5c273ce4afe38800c1310aac3ea17ba6bf59237983bb69f7681cbf99c01b3cf67af062e7c3622df1266813f:2cd0ddf8afe7538231a5a740461e0c9b	e81b15a1bd2a748ebe008a7c	ACTIVE	2027-09-09 18:20:24.517	2026-09-09 18:20:24.521	2026-09-09 18:20:24.521
0a033905-db63-4016-8933-8b0349fecd3a	c155c185-8749-476a-9522-2f43681365e9	a1e5fde2fdffa3973568ae7b35997354433bc5ea9aa74dc2325cbc73c59ed3c1e02bdb48910aa8fd3eef0b33bb7c6ebaacefa1f66d112c063778078f615b5f9c40802682ef1ddc6b8a74b160036ddc774c1e61fbe524c2c4a15fe5cc2381fb0613fd3c958affe016ef2ac6736315:d2b74449254dbc857a079c86e17d6e70	c406123c95dd844bf02b3157	ACTIVE	2027-09-09 18:46:57.848	2026-09-09 18:46:57.865	2026-09-09 18:46:57.865
5fc47457-afd6-4f57-8e6a-042ca8edd570	c155c185-8749-476a-9522-2f43681365e9	07dca0d1eeabc3c58b6c2a9dce16c2d78e20ff63975d4cff1a11596a321c66bc79b8353a77f4fe4e5cf63204cf5efbf8d26b715f345ed364e49c2231b8499274d17686aabacbcda8117e04a1edab123ec35221005ad5e795260964bb64290c5ab1afdae5306d2de20ccc3844c583:0cbbea9de2a40ac61cf1d0e0b626c466	e3c8f25eb15701857706c034	ACTIVE	2027-09-09 18:48:18.708	2026-09-09 18:48:18.714	2026-09-09 18:48:18.714
5bdfa707-5df3-4745-835c-5934e935482f	c155c185-8749-476a-9522-2f43681365e9	0ba1583fee58878438f84d064078a6b57b558632c3b263619f9436ce93dc34ed44fc955ac8ede24fd9b115021752963878d56b3bcc9422f7e23f6a418d490512e5dce158580a2356f073560ab61b3e3d16f2677a113e5a68312c679b91b8fdaa1c2c64c53b0f62213a2cb9e6835b:85a26f9a8803d0351230d61295a45aea	09c173340c9b373ca4579e69	ACTIVE	2027-09-09 18:49:03.058	2026-09-09 18:49:03.079	2026-09-09 18:49:03.079
\.


--
-- Data for Name: health_pack_shares; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.health_pack_shares (id, "healthPackId", "sharedWithUserId", "sharedWithHospitalId", status, "consentGranted", "sharedAt", "expiresAt", "revokedAt") FROM stdin;
23032a62-42ec-4737-82c9-30d68195082c	cf4d4f98-b177-4e41-a036-68c8db789162	7c07b141-4a7c-4981-985b-73d0006bfb6a	4c3d0517-27f4-4cc3-a6e7-5f2ac057859e	ACTIVE	t	2026-09-09 18:23:06.553	2026-09-10 18:23:06.552	\N
69a731e4-363f-4d24-97f7-cf1a37edca54	cf4d4f98-b177-4e41-a036-68c8db789162	7c07b141-4a7c-4981-985b-73d0006bfb6a	4c3d0517-27f4-4cc3-a6e7-5f2ac057859e	ACTIVE	t	2026-09-09 18:26:18.526	2026-09-10 18:26:18.524	\N
8cee72dd-49e2-42fa-b607-1ac8efa7a963	5fc47457-afd6-4f57-8e6a-042ca8edd570	\N	4c3d0517-27f4-4cc3-a6e7-5f2ac057859e	ACTIVE	t	2026-09-09 18:48:18.789	2026-09-10 18:48:18.788	\N
a00ffb0c-5dae-4d18-8c24-c94c0ed6d63a	5bdfa707-5df3-4745-835c-5934e935482f	\N	4c3d0517-27f4-4cc3-a6e7-5f2ac057859e	ACTIVE	t	2026-09-09 18:49:03.167	2026-09-10 18:49:03.165	\N
c31f550a-e3fe-4628-97af-f115391113e0	5bdfa707-5df3-4745-835c-5934e935482f	90281c6d-5cf1-4637-9938-6e9e410afde8	e8e41d60-fb8e-4c7a-8c1f-5f61fd49bd73	ACTIVE	t	2026-09-09 18:53:58.773	2026-09-10 18:53:58.771	\N
\.


--
-- Data for Name: hospital_requests; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.hospital_requests (id, "emergencyCaseId", "hospitalId", status, "distanceKm", "capabilityMatched", "availabilityMatched", "matchScore", "requestedAt", "respondedAt", "rejectionReason", "createdAt", "updatedAt") FROM stdin;
5c214c3d-37ae-4e85-a173-1985d3fc0d98	06cec23e-fd44-4a2a-ab46-14d1d0d9e78d	4c3d0517-27f4-4cc3-a6e7-5f2ac057859e	ACCEPTED	1.21117753229	t	t	1.21117753229	2026-09-09 18:23:06.463	2026-09-09 18:23:06.494	\N	2026-09-09 18:23:06.463	2026-09-09 18:23:06.499
9e73924a-5cc3-4976-8f50-ec327cce0e50	06cec23e-fd44-4a2a-ab46-14d1d0d9e78d	e8e41d60-fb8e-4c7a-8c1f-5f61fd49bd73	CANCELLED	15.72687138072	t	t	15.72687138072	2026-09-09 18:23:06.463	\N	\N	2026-09-09 18:23:06.463	2026-09-09 18:23:06.51
970061d7-e98a-4b2a-aacf-6506ec9395c4	f6340bf9-c85e-4270-8b69-0524f9183e8a	4c3d0517-27f4-4cc3-a6e7-5f2ac057859e	ACCEPTED	1.21117753229	t	t	1.21117753229	2026-09-09 18:26:18.297	2026-09-09 18:26:18.399	\N	2026-09-09 18:26:18.297	2026-09-09 18:26:18.407
f0de7010-250a-40fb-9736-f421c726ecf3	f6340bf9-c85e-4270-8b69-0524f9183e8a	e8e41d60-fb8e-4c7a-8c1f-5f61fd49bd73	CANCELLED	15.72687138072	t	t	15.72687138072	2026-09-09 18:26:18.297	\N	\N	2026-09-09 18:26:18.297	2026-09-09 18:26:18.432
e8bcb4f8-4015-4031-b6e1-48e62ad50505	a01be286-6291-4006-bb3a-a5a4e5903772	4c3d0517-27f4-4cc3-a6e7-5f2ac057859e	PENDING	1.21117753229	t	t	1.21117753229	2026-09-09 18:52:00.888	\N	\N	2026-09-09 18:52:00.888	2026-09-09 18:52:00.888
36bb32b0-4a85-48ed-9007-7affcf57ea08	a01be286-6291-4006-bb3a-a5a4e5903772	e8e41d60-fb8e-4c7a-8c1f-5f61fd49bd73	PENDING	15.72687138072	t	t	15.72687138072	2026-09-09 18:52:00.888	\N	\N	2026-09-09 18:52:00.888	2026-09-09 18:52:00.888
1073a4f8-0361-473e-88f0-ab528fc5f447	9d0686e0-d772-4b76-b611-2d8ca9864645	4c3d0517-27f4-4cc3-a6e7-5f2ac057859e	REJECTED	1.21117753229	t	t	1.21117753229	2026-09-09 18:53:58.606	2026-09-09 18:53:58.65	Busy	2026-09-09 18:53:58.606	2026-09-09 18:53:58.657
58f2958f-42ae-45de-8b35-9c0559ed522d	9d0686e0-d772-4b76-b611-2d8ca9864645	e8e41d60-fb8e-4c7a-8c1f-5f61fd49bd73	ACCEPTED	15.72687138072	t	t	15.72687138072	2026-09-09 18:53:58.606	2026-09-09 18:53:58.71	\N	2026-09-09 18:53:58.606	2026-09-09 18:53:58.711
\.


--
-- Data for Name: knowledge_documents; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.knowledge_documents (id, title, source, category, content, version, "isApproved", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: knowledge_chunks; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.knowledge_chunks (id, "documentId", content, embedding, "chunkIndex", "createdAt") FROM stdin;
\.


--
-- Data for Name: medical_documents; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.medical_documents (id, "healthPackId", "fileName", "fileUrl", "fileType", "fileSize", "processingStatus", "extractedText", "extractedConditions", "extractedMedications", "extractedAllergies", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.notifications (id, "userId", type, title, message, status, data, "createdAt", "readAt") FROM stdin;
03273e5d-f47c-4b0f-adff-882f1bb9a9a9	7c07b141-4a7c-4981-985b-73d0006bfb6a	HOSPITAL_REQUEST	New Emergency Case Assigned	An emergency case (CASE-20260909-A69EC2) requires your immediate attention.	UNREAD	{"emergencyCaseId": "06cec23e-fd44-4a2a-ab46-14d1d0d9e78d"}	2026-09-09 18:23:06.471	\N
2c55a8a5-64e8-452d-bb17-1f59e5cd773e	90281c6d-5cf1-4637-9938-6e9e410afde8	HOSPITAL_REQUEST	New Emergency Case Assigned	An emergency case (CASE-20260909-A69EC2) requires your immediate attention.	UNREAD	{"emergencyCaseId": "06cec23e-fd44-4a2a-ab46-14d1d0d9e78d"}	2026-09-09 18:23:06.471	\N
201b1336-2245-4a63-9bc5-9e51dbbba863	7c07b141-4a7c-4981-985b-73d0006bfb6a	HOSPITAL_REQUEST	New Emergency Case Assigned	An emergency case (CASE-20260909-A5B3B8) requires your immediate attention.	UNREAD	{"emergencyCaseId": "f6340bf9-c85e-4270-8b69-0524f9183e8a"}	2026-09-09 18:26:18.338	\N
1a83c542-f54e-4551-9157-c87d75802bda	90281c6d-5cf1-4637-9938-6e9e410afde8	HOSPITAL_REQUEST	New Emergency Case Assigned	An emergency case (CASE-20260909-A5B3B8) requires your immediate attention.	UNREAD	{"emergencyCaseId": "f6340bf9-c85e-4270-8b69-0524f9183e8a"}	2026-09-09 18:26:18.338	\N
1473899b-b809-4df3-9102-6eab8359b089	7c07b141-4a7c-4981-985b-73d0006bfb6a	HOSPITAL_REQUEST	New Emergency Case Assigned	An emergency case (CASE-20260909-C1FFC3) requires your immediate attention.	UNREAD	{"emergencyCaseId": "a01be286-6291-4006-bb3a-a5a4e5903772"}	2026-09-09 18:52:00.896	\N
b0a68585-958f-4834-8898-8a3ac36504f8	90281c6d-5cf1-4637-9938-6e9e410afde8	HOSPITAL_REQUEST	New Emergency Case Assigned	An emergency case (CASE-20260909-C1FFC3) requires your immediate attention.	UNREAD	{"emergencyCaseId": "a01be286-6291-4006-bb3a-a5a4e5903772"}	2026-09-09 18:52:00.896	\N
a3c1df12-a243-40d3-9270-bdbd786762b8	7c07b141-4a7c-4981-985b-73d0006bfb6a	HOSPITAL_REQUEST	New Emergency Case Assigned	An emergency case (CASE-20260909-E87D54) requires your immediate attention.	UNREAD	{"emergencyCaseId": "9d0686e0-d772-4b76-b611-2d8ca9864645"}	2026-09-09 18:53:58.617	\N
2c332b99-2910-4346-941d-4a13c922f476	90281c6d-5cf1-4637-9938-6e9e410afde8	HOSPITAL_REQUEST	New Emergency Case Assigned	An emergency case (CASE-20260909-E87D54) requires your immediate attention.	UNREAD	{"emergencyCaseId": "9d0686e0-d772-4b76-b611-2d8ca9864645"}	2026-09-09 18:53:58.617	\N
152c4aef-2268-4415-8121-f596449f5e98	90281c6d-5cf1-4637-9938-6e9e410afde8	SOS	EMERGENCY SOS MATCH (Cascade)	New SOS routed to you. Type: CARDIAC, Severity: RED	UNREAD	{"caseId": "9d0686e0-d772-4b76-b611-2d8ca9864645"}	2026-09-09 18:53:58.692	\N
\.


--
-- Data for Name: patient_locations; Type: TABLE DATA; Schema: public; Owner: caresetu
--

COPY public.patient_locations (id, "patientId", latitude, longitude, accuracy, source, "createdAt") FROM stdin;
\.


--
-- Data for Name: geocode_settings; Type: TABLE DATA; Schema: tiger; Owner: caresetu
--

COPY tiger.geocode_settings (name, setting, unit, category, short_desc) FROM stdin;
\.


--
-- Data for Name: pagc_gaz; Type: TABLE DATA; Schema: tiger; Owner: caresetu
--

COPY tiger.pagc_gaz (id, seq, word, stdword, token, is_custom) FROM stdin;
\.


--
-- Data for Name: pagc_lex; Type: TABLE DATA; Schema: tiger; Owner: caresetu
--

COPY tiger.pagc_lex (id, seq, word, stdword, token, is_custom) FROM stdin;
\.


--
-- Data for Name: pagc_rules; Type: TABLE DATA; Schema: tiger; Owner: caresetu
--

COPY tiger.pagc_rules (id, rule, is_custom) FROM stdin;
\.


--
-- Data for Name: topology; Type: TABLE DATA; Schema: topology; Owner: caresetu
--

COPY topology.topology (id, name, srid, "precision", hasz) FROM stdin;
\.


--
-- Data for Name: layer; Type: TABLE DATA; Schema: topology; Owner: caresetu
--

COPY topology.layer (topology_id, layer_id, schema_name, table_name, feature_column, feature_type, level, child_id) FROM stdin;
\.


--
-- Name: topology_id_seq; Type: SEQUENCE SET; Schema: topology; Owner: caresetu
--

SELECT pg_catalog.setval('topology.topology_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

