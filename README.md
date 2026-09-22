# CareSetu
 
<p align="center">

  <strong>AI-Integrated Healthcare & Emergency Response Platform</strong>

</p>



<p align="center">

  A web/PWA-based healthcare platform for intelligent triage, emergency SOS,

  capability-aware hospital matching, secure emergency health information

  sharing, and offline emergency continuity.
  

</p>



---



## Overview



**CareSetu** is a web/PWA-based healthcare and emergency response platform designed to connect patients with suitable healthcare facilities during both normal and emergency situations.

**CareSetu combines:**

- Patient healthcare profiles
- Medical records
- AI-assisted healthcare interaction
- Symptom and intent extraction
- Context retrieval
- Emergency signal detection
- Emergency triage assistance
- GPS-based emergency response
- Temporary Emergency Case IDs
- Smart hospital matching
- Hospital capability matching
- Hospital availability matching
- Distance-based ranking
- Progressive hospital search
- Emergency Health Packs
- Hospital accept/reject workflow
- Emergency case tracking
- Consent management
- Role-based access control
- Audit logging
- Offline-first emergency support

CareSetu is designed as a **healthcare coordination and emergency-response platform**, not as an autonomous AI doctor.

**AI is used to assist with:**

- Query understanding
- Symptom extraction
- Intent detection
- Retrieval
- Summarization
- OCR
- Translation
- Triage assistance

Critical emergency workflows are designed to use **deterministic safety rules and defined emergency procedures**, rather than relying only on an LLM.




**The platform combines:**



- Patient healthcare profiles

- Medical records

- AI-assisted healthcare interaction

- Symptom and intent extraction

- Emergency/triage assistance

- GPS-based emergency response

- Temporary emergency Case IDs

- Smart hospital matching

- Capability + Availability + Distance based selection

- Progressive hospital search

- Secure Emergency Health Packs

- Hospital accept/reject workflow

- Emergency case tracking

- Offline-first emergency support

- Role-based access control

- Consent and audit mechanisms



CareSetu is designed as a **healthcare coordination and emergency-response platform**, not as an autonomous AI doctor.



AI assists with understanding, retrieval, summarization, OCR, translation, and triage support. Emergency decisions are supported by deterministic safety rules and defined emergency workflows rather than relying solely on an LLM.



---



## 🎯 Problem Statement



Every year, thousands of people die because they can't reach hospitals in time during emergencies. Current ambulance systems are slow, unorganized, and lack real-time coordination.





During a medical emergency, patients and their families may face several problems:



- Difficulty identifying the right healthcare facility

- Lack of awareness of hospital capabilities

- Uncertainty about current hospital availability

- Delays caused by searching for suitable facilities

- Important medical information being unavailable during emergencies

- Repeatedly explaining medical history

- Connectivity problems in critical situations

- Lack of coordinated communication between patient and hospital

- Security and privacy concerns around sensitive medical information



A hospital being geographically close does not necessarily mean it is suitable for a particular emergency.



For example:
> A patient requiring cardiac emergency care should preferably be connected to a hospital with the required cardiac capability and emergency availability rather than simply selecting the nearest hospital.

**Key Issues:**

- ❌ No quick way to alert nearby hospitals

- ❌ Patient medical history not available during emergencies

- ❌ Hospitals don't know about emergencies until patient arrives

- ❌ No system to match patient needs with hospital capabilities



---




## 💡 Solution

CareSetu provides a unified healthcare and emergency coordination platform.

**CARESETU** is a one-click emergency platform that:

- ✅ Connects patients to nearby hospitals instantly

- ✅ Shares encrypted medical history (Health Pack) with hospitals

- ✅ Uses AI to detect emergency severity

- ✅ Provides real-time case tracking

The core emergency workflow is:



```text

Patient

   ↓

Condition / AI Chat

   ↓

Triage Assistance

   ↓

Normal / Critical

   │

   ├── Normal

   │     ↓

   │   Health Guidance

   │     ↓

   │   Optional Hospital Discovery

   │

   └── Critical

         ↓

        SOS

         ↓

      GPS Location

         ↓

   Temporary Case ID

         ↓

   Emergency Case

         ↓

   Hospital Matching

         ↓

   8 → 16 → 32 → 64 km

         ↓

   Hospital Request

         ↓

    Accept / Reject

         ↓

   Hospital Assignment

         ↓

 Emergency Health Pack

         ↓

       Treatment

         ↓

     Case Closure

```
---



## 🚀 Key Features



### For Patients:

- 🆘 One-Click SOS Button

- 📍 GPS Location Sharing

- 🏥 Nearby Hospital Matching (8km radius)

- 💊 Encrypted Health Pack

- 📊 Real-time Case Status



### For Hospitals:

- 📱 Emergency Alerts (SMS/Push)

- ✅ Accept/Reject Cases

- 📋 View Patient Health Pack

- 📈 Dashboard & Analytics



### For Admins:

- 👥 User Management

- 🏥 Hospital Verification

- 📊 System Analytics

- 📝 Audit Logs




---



## 🛠️ Tech Stack



### Frontend:

- React.js 18

- Tailwind CSS

- PWA (Progressive Web App)

- Service Workers (Offline Support)



### Backend:

- Node.js 20

- Express.js 4

- Prisma ORM

- PostgreSQL 16 + PostGIS

- JWT Authentication

- bcrypt (Password Hashing)



### AI Service (Optional):

- Python 3.11

- FastAPI

- Hugging Face Transformers

- BioBERT Model



### Deployment:

- Docker & Docker Compose

- Nginx (Load Balancer)

- Let's Encrypt SSL

- AWS/DigitalOcean



---


```text
🏗️ Architecture
Plaintext
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│   Backend   │────▶│  Database   │
│  (React)    │◀────│ (Node.js)   │◀────│ (PostgreSQL)│
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  AI Service │
                    │   (Python)  │
                    └─────────────┘
```
---



## 📦 Installation



### Prerequisites:

- Node.js 20+

- Docker & Docker Compose

- PostgreSQL 16+



### Quick Start:



```bash

# Clone repository

git clone https://github.com/your-team/caresetu.git

cd caresetu



# Copy environment variables

cp .env.example .env



# Edit .env with your values

nano .env



# Start all services

docker-compose up -d



# Check status

docker-compose ps



# View logs

docker-compose logs -f

```



### Manual Setup:



```bash

# Backend

cd backend

npm install

npm run dev



# Frontend

cd frontend

npm install

npm start



# AI Service (Optional)

cd ai-service

pip install -r requirements.txt

uvicorn src.main:app --reload

```



---



## 🎯 Usage

## 🎯 Usage

### Patient Flow:
1. Login/Signup
2. Create Profile & Add Medical Info
3. Click SOS Button in Emergency
4. Share Symptoms & Location
5. Track Case Status

### Hospital Flow:
1. Login
2. Receive Emergency Alerts
3. Accept/Reject Cases
4. View Patient Health Pack
5. Provide Treatment

---



## 📡 API Documentation

### Authentication:
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/request-otp` - Request Phone or Email OTP
- `POST /api/auth/verify-otp` - Verify Phone or Email OTP
- `POST /api/auth/cancel-registration` - Revoke pending registration OTP session
- `POST /api/auth/forgot-password` - Request 2-step dual OTP (Email + SMS) password reset
- `POST /api/auth/verify-reset-phone-otp` - Verify Phone OTP and receive single-use reset authorization token
- `POST /api/auth/cancel-forgot-password` - Revoke pending password reset OTP session
- `POST /api/auth/reset-password` - Reset account password with valid single-use reset token

### Patient:
- `GET /api/patients/profile` - Get profile
- `PUT /api/patients/profile` - Update profile
- `POST /api/patients/medical-records` - Upload records

### Emergency:
- `POST /api/emergency/sos` - Create SOS
- `GET /api/emergency/status/:caseId` - Get status
- `PUT /api/emergency/cancel/:caseId` - Cancel SOS

### Hospital:
- `GET /api/hospitals/nearby` - Find nearby hospitals
- `GET /api/hospitals/alerts` - Get emergency alerts
- `POST /api/hospitals/accept/:caseId` - Accept case
- `GET /api/hospitals/health-pack/:caseId` - View health pack



**Full API Docs:** [docs/API.md](docs/API.md)



---



## 📸 Screenshots



### Patient Dashboard:

![Patient Dashboard](docs/screenshots/patient-dashboard.png)



### SOS Button:

![SOS Button](docs/screenshots/sos-button.png)



### Hospital Dashboard:

![Hospital Dashboard](docs/screenshots/hospital-dashboard.png)



---





---

## 📦 Installation

### Prerequisites:
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16+

### Quick Start:

```bash
# Clone repository
git clone https://github.com/your-team/caresetu.git
cd caresetu

# Copy environment variables
cp .env.example .env

# Edit .env with your values
nano .env

# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

---

## 🔐 Registration & 2FA Verification Architecture

CareSetu implements a secure multi-step verification process requiring separate validation for both phone numbers (via SMS) and email addresses prior to account creation.

### Verification Workflow:
1. **Phone Number Verification**:
   - User inputs a 10-digit Indian phone number (`+91`).
   - Clicking **Verify Number** dispatches a 6-digit OTP via TextBee SMS service (`purpose: "PHONE_VERIFICATION"`).
   - Dedicated OTP screen displays masked phone (`+91 98*** **210`).
   - Entering the 6th digit auto-verifies the OTP against the backend API and database (`prisma.otp`).
   - Upon verification success, a checkmark animation displays, and the user returns to the form with the **Phone Number Verified** badge activated and all previously entered form fields preserved.

2. **Email Address Verification**:
   - User inputs their email address.
   - Clicking **Verify Email** dispatches a 6-digit OTP via Brevo Email service (`purpose: "EMAIL_VERIFICATION"`).
   - Dedicated OTP screen displays masked email (`y***@example.com`).
   - 6-digit auto-verification validates the code against `prisma.otp`.
   - Upon verification success, the **Email Verified** badge activates, returning to the registration form with intact state.

3. **Backend Security & Database Enforcement**:
   - The backend `register` endpoint ([`auth.controller.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/controllers/auth.controller.js)) checks `prisma.otp` for active, verified records (`verifiedAt != null`) for both `phone` and `email`.
   - Direct API registration attempts without prior database-verified OTP records are rejected with HTTP 400.
   - Verified OTP records are consumed and purged upon successful user account creation to prevent reuse.

### Required Environment Variables:
```env
# TextBee SMS API Integration (Phone OTP)
TEXTBEE_API_KEY=your_textbee_api_key
TEXTBEE_DEVICE_ID=your_textbee_device_id

# Brevo Email API Integration (Email OTP)
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=noreply@caresetu.com
BREVO_SENDER_NAME=CareSetu Platform
```

### Testing Commands:
```bash
# Run Frontend TypeScript compilation checks
cd frontend && cmd /c "npx tsc --noEmit"

# Run Backend security & authentication test suite
cd backend && cmd /c "npm test"
```

### Troubleshooting:
- **TextBee SMS Delays**: Ensure `TEXTBEE_DEVICE_ID` is active in the TextBee gateway app. In local development (`NODE_ENV=development`), plain-text OTPs are logged to backend stdout for rapid testing.
- **Brevo Email 401 Unrecognised IP**: In Brevo dashboard under Security -> Authorised IPs, whitelist your current public IP address or enable demo mock fallback mode.

---

## 👥 Team

| Name | Role | GitHub |
|------|------|--------|
| Yash | Team Lead & Backend / System Architect | [@yash-github](https://github.com/yspanchal6) |
| Member 2 | Frontend Developer | [@member2](https://github.com/member2) |
| Member 3 | Backend Developer | [@member3](https://github.com/member3) |
| Member 4 | AI/ML Developer | [@member4](https://github.com/member4) |
| Member 5 | UI/UX Designer | [@member5](https://github.com/member5) |

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

- Mentors & Judges
- Open Source Contributors

---

## 📞 Contact

- **Project Link:** https://github.com/your-team/caresetu
- **Demo:** https://caresetu.com
- **Email:** team@caresetu.com

---

**Made with ❤️ for Smart India Hackathon 2026**
README.md
Displaying README.md.
