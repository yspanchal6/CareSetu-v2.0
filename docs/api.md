# CareSetu REST API Specification

**Base URL:** `http://localhost:3000/api`  
**Authentication:** Bearer JWT Token (`Authorization: Bearer <token>`)  

---

## 1. Authentication Endpoints

### `POST /api/auth/register`
Creates a new user account.

**Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Password123!",
  "phone": "+919876543210",
  "role": "PATIENT"
}
```

**Response (HTTP 201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "usr_12345",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "PATIENT"
  },
  "token": "eyJhbGciOiJIUzI1Ni..."
}
```

---

### `POST /api/auth/login`
Authenticates an existing user.

**Request Body:**
```json
{
  "email": "jane@example.com",
  "password": "Password123!"
}
```

**Response (HTTP 200):**
```json
{
  "token": "eyJhbGciOiJIUzI1Ni...",
  "user": {
    "id": "usr_12345",
    "email": "jane@example.com",
    "role": "PATIENT"
  }
}
```

---

## 2. Emergency SOS Endpoints

### `POST /api/emergency/sos`
Triggers an emergency SOS dispatch.

**Headers:** `Authorization: Bearer <PATIENT_JWT>`

**Request Body:**
```json
{
  "latitude": 23.0225,
  "longitude": 72.5714,
  "emergencyType": "CARDIAC",
  "notes": "Severe chest pain"
}
```

**Response (HTTP 200):**
```json
{
  "success": true,
  "sosId": "sos_998877",
  "status": "DISPATCHING",
  "matchedHospitals": 3
}
```

---

## 3. Doctor AI Chat Assistant Endpoints

### `POST /api/chat/message`
Sends a query to the Doctor AI assistant.

**Headers:** `Authorization: Bearer <PATIENT_JWT>`

**Request Body:**
```json
{
  "message": "I have had a fever and mild headache for 2 days",
  "includeHealthPack": true
}
```

**Response (HTTP 200):**
```json
{
  "response": "**Understanding:** Summary of fever...\n\n**Possible Considerations:** Common viral causes...\n\n**Recommended Next Step:** Rest and hydration...",
  "intent": "GENERAL_HEALTH",
  "isEmergency": false,
  "symptoms": ["fever", "headache"],
  "ragScore": 0.78
}
```
