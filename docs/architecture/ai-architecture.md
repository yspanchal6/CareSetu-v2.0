### AI Service (Python + FastAPI)
 
**1. NLP Module**
- Understanding
- Intent & entity extraction
- Symptom extraction
**2. RAG (Knowledge Layer)**
- pgVector store
- Healthcare knowledge base
- First-aid guidance
- Handling general health info, etc.
**3. Emergency Detection Engine**
- Checks risk / seriousness of case
- Flag detection: **RED / Orange / Yellow / Green**
**Technology:** Python + FastAPI, Hugging Face models
 
---
 
 
## AI Architecture
 
> Modular flow: **React → Express → Python AI Service → LLM → Safety Engine → CareSetu workflow**
 
### Complete AI System Flow
 
```text
                         CARESETU AI SYSTEM
                                │
                                ▼
                         Patient / User
                                │
                                ▼
                         React / PWA Chat
                                │
                                ▼
                     POST /api/ai/chat
                                │
                                ▼
                    Node.js / Express Backend
                                │
                         AI Controller
                                │
                         AI Service Layer
                                │
                                ▼
                    ┌─────────────────────┐
                    │   AI ORCHESTRATOR   │
                    └──────────┬──────────┘
                               │
             ┌─────────────────┼─────────────────┐
             ▼                 ▼                 ▼
      Query Understanding  Symptom/Intent   Context Retrieval
             │             Extraction            │
             │                 │                 │
             └─────────────────┼─────────────────┘
                               ▼
                     Emergency Signal
                         Detection
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
                  NORMAL               RED FLAG
                    │                     │
                    ▼                     ▼
              RAG / Guidance       SAFETY RULE ENGINE
                    │                     │
                    ▼                     ▼
              AI Response             CRITICAL
                                          │
                                          ▼
                                    SOS FLOW
                                          │
                               GPS + Case ID
                                          │
                                          ▼
                                  Hospital Matching
```
 
---
 
### 1. AI Service Architecture
 
AI/ML processing is kept in a **separate Python FastAPI service**, decoupled from the core Node.js backend.
 
```text
    Node.js / Express
           │
           │ HTTP
           ▼
    Python FastAPI
           │
           ▼
     AI Orchestrator
           │
     ┌─────┼──────────┐
     ▼     ▼          ▼
    NLP   LLM       RAG
    │     │          │
    ▼     ▼          ▼
    Symptoms      pgvector
    Intent
    Red Flags
```
 
**Technology:**
| Component | Tech |
|---|---|
| API gateway/orchestration | Node.js + Express |
| AI service | Python + FastAPI |
| Model processing | Hugging Face / LLM API |
| RAG knowledge retrieval | PostgreSQL + pgvector |
| Medical-document processing | OCR |
| Deterministic emergency safety layer | JavaScript Safety Rule Engine |
 
---
 
### 2. AI Chatbot Flow
 
```text
            User Query
                ↓
            Input Processor
                ↓
            AI Orchestrator
                ↓
            Query Understanding
                ↓
            Symptom Extraction
                ↓
            Intent Detection
                ↓
            Emergency Signal Detection
                ↓
            Safety Check
                ↓
┌───────────────┬────────────────┐
│               │                │
Normal          Unclear          Critical
│               │                │
↓               ↓                ↓
RAG             Clarification    Safety Rule
↓               ↓                ↓
LLM Response    LLM Response     SOS Flow
```
 
---
 
### 3. Safety Rule Engine
 
**This is the most important AI-safety component.**
 
❌ Not allowed: `LLM → Directly → SOS`
 
Instead, all emergency signals pass through a deterministic rule layer:
 
```text
LLM / NLP
    ↓
Red-Flag Signal
    ↓
Safety Rule Engine
    ↓
Deterministic Rules
    ↓
Emergency Decision
    ↓
SOS
```
 
**Example:**
```text
User: "I have severe chest pain and difficulty breathing."
        ↓
AI/NLP
        ↓
Symptoms: [chest pain, breathing difficulty]
        ↓
Safety Rule Engine
        ↓
High-risk red flags detected
        ↓
CRITICAL
        ↓
Emergency Warning
        ↓
SOS Flow
```
 
**Red-flag combinations checked by the rule engine:**
- Chest pain
- Severe breathing difficulty
- Unconsciousness
- Severe bleeding
- Seizure
- Stroke-like symptoms
- Other approved emergency indicators

 
---
 
### 4. RAG Architecture
 
For approved healthcare information:
 
```text
User Question
      ↓
Query Processing
      ↓
Embedding Generation
      ↓
pgvector Search
      ↓
Relevant Healthcare Documents
      ↓
Relevance Check
      ↓
Context
      ↓
LLM
      ↓
Safety / Response Validation
      ↓
Final Answer
```
 
**Example:**
```text
"What should I do for a minor burn?"
        ↓
Retrieve approved first-aid guidance
        ↓
LLM generates response using retrieved context
        ↓
Safety Check
        ↓
Answer
```
 
> Keeps healthcare guidance grounded in the approved knowledge base instead of relying entirely on the model's internal knowledge.
 
---
 
### 5. Medical Document AI (Health Pack — Feature 4)
 
```text
Medical Report
      ↓
Upload
      ↓
Secure File Storage
      ↓
OCR
      ↓
Text Extraction
      ↓
NLP / Document Understanding
      ↓
Important Information
 ├── Conditions
 ├── Medicines
 ├── Allergies
 └── Relevant History
      ↓
Structured Medical Data
      ↓
Health Pack
```
 
> AI assists with extraction/summarization; the original document remains the source of truth.
 
---
 
### 6. Complete CareSetu AI Architecture
 
```text
                              CARESETU
                                 │
                            React / PWA
                                 │
                                 ▼
                         Node.js / Express
                                 │
                       ┌─────────┴─────────┐
                       │                   │
                       ▼                   ▼
                  AI Service          Core Backend
                       │                   │
                       ▼                   │
                Python / FastAPI           │
                       │                   │
                AI Orchestrator            │
                       │                   │
          ┌────────────┼────────────┐      │
          ▼            ▼            ▼      │
       NLP/Symptom    RAG          LLM     │
       Extraction      │            │      │
          │            ▼            │      │
          │        pgvector         │      │
          │                         │      │
          └────────────┬────────────┘      │
                       ▼                   │
                Emergency Signal           │
                       │                   │
                       ▼                   │
              Safety Rule Engine           │
                       │                   │
                ┌──────┴──────┐            │
                ▼             ▼            │
              Normal       Critical        │
                │             │            │
                ▼             ▼            │
           RAG Response      SOS ──────────┘
                              │
                              ▼
                         GPS + Case ID
                              │
                              ▼
                       Hospital Matching
                              │
                              ▼
                       Emergency Health
                            Pack
```
 
---
 
### 7. AI Ownership (Team Division)
 
| Owner | Responsibilities |
|---|---|
| **M1** | AI chatbot integration, LLM API integration, symptom/intent extraction, red-flag detection, Safety Rule Engine, AI → SOS integration |
| **M2** | AI integration for Health Pack, OCR, medical-document extraction, medical-data summarization |
| **You** | AI architecture, security/privacy, AI data-access boundaries, safety architecture review, final integration |
 
**Most important rule:** AI should never have unrestricted access to the entire patient database.
 
```text
User Request
     ↓
Authorization
     ↓
Required Data Only
     ↓
AI Service
     ↓
Response
```
 
**For emergencies:**
```text
AI Signal
    ↓
Safety Rule Engine
    ↓
Emergency Workflow
```
 

 


