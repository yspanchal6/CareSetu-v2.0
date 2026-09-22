## AI Safety Engine & Chatbot — Detailed Component Architecture (M1 + M2)
 
```text
        +--------------------------------------------------------+
        |             AI ARCHITECTURE (M1 + M2)                  |
        +--------------------------------------------------------+
                                 |
                 +---------------+----------------+
                 |                                |
                 v                                v
    +----------------------------+   +----------------------------+
    |  COMPONENT 1: SAFETY       |   |  COMPONENT 2: AI CHATBOT   |
    |  ENGINE (M1)               |   |  (M2)                      |
    +----------------------------+   +----------------------------+
```
 
---
 
### Component 1 — Safety Engine (M1)
 
**Purpose:** Detect emergency keywords in user messages and auto-trigger SOS.
 
```text
User Message (e.g. "I have severe chest pain")
        |
        v
+------------------------------------------------+
|  PREPROCESSING                                  |
|  - Lowercase: "i have severe chest pain"        |
|  - Remove special characters                    |
|  - Tokenize: [i, have, severe, chest, pain]     |
+------------------------------------------------+
        |
        v
+------------------------------------------------+
|  KEYWORD MATCHING (Rule-based)                  |
|  - Check against RED_FLAG_WORDS list            |
|  - Exact match: "chest pain" ✓                  |
|  - Fuzzy match: "chestpain", "chest-pain"       |
|  - Synonyms: "cardiac pain", "heart pain"       |
+------------------------------------------------+
        |
        v
+------------------------------------------------+
|  CONTEXT ANALYSIS (AI/ML-based)                 |
|  - NLP model understands context                |
|  - Is phrase used in an emergency context?      |
|  - Reduces false positives                      |
|    (e.g. "I had chest pain last year")          |
|  - Model: fine-tuned BioBERT / simple classifier|
+------------------------------------------------+
        |
        v
+------------------------------------------------+
|  EMERGENCY CLASSIFICATION                       |
|  RED    - Life-threatening (heart attack,       |
|           stroke, unconscious)                  |
|  ORANGE - Serious (accident, severe bleeding,   |
|           fracture)                              |
|  YELLOW - Moderate (fever, pain, allergic rxn)  |
|  GREEN  - Non-urgent (general inquiry, appt.)   |
+------------------------------------------------+
        |
        v
   OUTPUT (JSON)
```
 
```json
{
  "isEmergency": true,
  "severity": "RED",
  "detectedWords": ["chest pain"],
  "confidence": 0.95,
  "recommendedAction": "Redirect to SOS immediately"
}
```
 
**Red-flag word list (categorized):**
 
| Category | Severity | Example terms |
|---|---|---|
| Cardiac | RED | chest pain, heart attack, cardiac arrest, angina, pressure in chest, tightness in chest, pain in left arm, radiating chest pain |
| Respiratory | RED/ORANGE | can't breathe, difficulty breathing, shortness of breath, choking, asthma attack, wheezing, gasping for air |
| Trauma | ORANGE | accident, fall, bleeding, unconscious, head injury, broken bone, fracture, severe bleeding, deep cut |
| Neurological | RED | stroke, paralysis, numbness, slurred speech, confusion, seizure, dizziness, loss of consciousness |
| Other | YELLOW/RED | severe pain, poisoning, overdose, suicide, drowning, burn, convulsion, high fever, allergic reaction |
 
---
 
### Component 2 — AI Chatbot (M2)
 
**Purpose:** Provide medical information and symptom analysis via LLM.
 
```text
User sends message to /api/chat
        |
        v
+------------------------------------------------+
|  SAFETY ENGINE MIDDLEWARE (M1)                  |
|  - Intercepts BEFORE chatbot processes          |
|  - Checks red-flag words                        |
|  - AI context analysis                          |
+------------------------------------------------+
        |
        v
   EMERGENCY DETECTED?
        |
  +-----+-----+
  |           |
 YES          NO
  |           |
  v           v
```
 
**If YES — short-circuit the chatbot:**
 
```json
{
  "isEmergency": true,
  "severity": "RED",
  "detectedWords": ["chest pain"],
  "message": "Emergency detected! Redirecting to SOS...",
  "redirectUrl": "/emergency/sos"
}
```
> Frontend shows a warning alert and redirects to the SOS page.
 
**If NO — continue to RAG + LLM:**
 
```text
+------------------------------------------------+
|  RAG (Retrieval-Augmented Generation) - Optional|
|  1. Generate embedding for message (768-dim)    |
|  2. Search pgvector for similar medical KB      |
|  3. Retrieve top-3 relevant documents           |
|  4. Augment prompt:                             |
|     "You are a medical assistant.               |
|      Context: {retrieved_docs}                  |
|      User question: {user_message}"             |
+------------------------------------------------+
        |
        v
+------------------------------------------------+
|  LLM API CALL (Hugging Face / OpenAI)           |
|  - Model: BioBERT (medical NLP) or GPT-3.5-turbo|
|  - POST https://api.huggingface.co/models/      |
|         microsoft/BioBERT                       |
|  - Header: Authorization: Bearer {HF_API_KEY}   |
|  - Payload: { inputs: augmented_prompt }        |
|  - Config: temperature=0.7, max_tokens=500      |
+------------------------------------------------+
        |
        v
   OUTPUT: AI Response
```
 
```json
{
  "success": true,
  "message": "Based on your symptoms, you should...",
  "disclaimer": "This is not medical advice. Consult a doctor."
}
```
 
**pgvector structure (for RAG — optional):**
 
```sql
Table: embeddings
├── id            UUID PRIMARY KEY
├── content       TEXT (medical knowledge text)
├── source        TEXT (URL or document name)
├── embedding     vector(768) (BioBERT 768-dim embeddings)
├── category      TEXT (symptom, treatment, medication, diagnosis)
└── created_at    TIMESTAMP WITH TIME ZONE
 
-- Index
CREATE INDEX idx_embeddings_vector ON embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
 
-- Cosine similarity search
SELECT content, 1 - (embedding <=> query_vector) AS similarity
FROM embeddings
ORDER BY embedding <=> query_vector
LIMIT 3;
```
 
---
 
### AI Integration — Safety Engine + Chatbot Middleware Chain
 
```text
app.post('/api/chat',
  safetyEngineMiddleware,   // M1: Check for emergencies FIRST
  authMiddleware,           // Verify JWT
  validationMiddleware,     // Zod validation
  chatController.sendMessage // M2: Process with LLM
);
```
 
```text
                 Incoming /api/chat request
                              |
                              v
                +----------------------------+
                |  SAFETY ENGINE MIDDLEWARE  |
                |         (M1, runs first)   |
                +----------------------------+
                              |
                     req.isEmergency = ?
                    /                    \
                 true                   false
                   |                      |
                   v                      v
          Skip Auth/Validation      +--------------+
          Return redirect signal    | authMiddleware|
          → /emergency/sos          +--------------+
                                            |
                                            v
                                  +----------------------+
                                  | validationMiddleware |
                                  |     (Zod schema)     |
                                  +----------------------+
                                            |
                                            v
                                  +----------------------+
                                  | chatController.       |
                                  | sendMessage (M2)      |
                                  |  RAG → LLM → Response |
                                  +----------------------+
```
 
> Core rule: the Safety Engine always runs **before** authentication/validation/LLM — an emergency is short-circuited immediately, and the LLM never gets a chance to directly control the SOS action.
