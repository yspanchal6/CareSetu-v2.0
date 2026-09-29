# CARESETU V2.0 — STEP 4: MULTILINGUAL i18n FOUNDATION DOCUMENTATION

## 1. Overview & Architecture

CareSetu V2.0 Step 4 establishes an extensible, production-grade internationalization (i18n) foundation designed to support Indian languages seamlessly without restructuring the frontend or backend application architecture.

The initial release supports 3 core languages:
1. **English (`en`)** — Default / Fallback
2. **Hindi (`hi`) — हिन्दी**
3. **Gujarati (`gu`) — ગુજરાતી**

### Core Directory Structure

```
frontend/src/i18n/
├── config.ts              # Authoritative central language metadata configuration
├── types.ts               # TypeScript types for i18n context & resources
├── I18nContext.tsx        # React Provider, useTranslation hook, interpolation & formatting
├── index.ts               # Barrel exports
└── locales/
    ├── en.json            # English human-authored locale resource
    ├── hi.json            # Hindi human-authored locale resource
    └── gu.json            # Gujarati human-authored locale resource
```

---

## 2. Central Language Metadata (`config.ts`)

Each supported language is registered in `SUPPORTED_LANGUAGES`:

| Code | English Name | Native Name | Direction | Default |
|------|--------------|-------------|-----------|---------|
| `en` | English | English | `ltr` | Yes |
| `hi` | Hindi | हिन्दी | `ltr` | No |
| `gu` | Gujarati | ગુજરાતી | `ltr` | No |

Future Indian languages (Tamil, Telugu, Marathi, Bengali, Kannada, Malayalam, Punjabi, Odia, Assamese, etc.) can be added by declaring new entries in `SUPPORTED_LANGUAGES` and providing corresponding `.json` locale resources in `locales/`.

---

## 3. Language Selector Component (`LanguageSelector.tsx`)

A reusable, accessible, responsive `LanguageSelector` dropdown component is provided in `frontend/src/components/common/LanguageSelector.tsx`.

### Key Features:
- Displays globe icon with readable native language names (`English`, `हिन्दी`, `ગુજરાતી`).
- Full keyboard navigation (Tab, Enter, Space, Escape, Arrow keys).
- Accessible ARIA attributes (`role="listbox"`, `aria-expanded`, `aria-selected`).
- Respects `prefers-reduced-motion` with clean immediate transitions.
- Integrated into `PublicNavbar` (guest/public) and `Topbar` (patient/doctor/hospital).
- Conditionally hidden for Admin portal per Phase 28 requirements to preserve Admin business logic.

---

## 4. Preference Resolution & Persistence

Language selection follows a deterministic resolution hierarchy:

1. **Authenticated User Saved Preference** (stored in user profile/session)
2. **Guest Saved Preference** (`localStorage.getItem('caresetu_lang')`)
3. **Existing Application Preference**
4. **Browser Language Detection** (`navigator.language`)
5. **English Fallback (`en`)**

### Security & Isolation Rules:
- Language codes are validated against `['en', 'hi', 'gu']`. Invalid codes or injection strings (`<script>`) are automatically sanitized to `en`.
- Logging out clears guest state and restores default language without leaking preferences between user accounts.

---

## 5. Interpolation, Pluralization & Locale Formatting

### Interpolation
Curly brace placeholders are replaced safely without concatenating translated strings:
```typescript
t('common.welcomeUser', { name: 'Priya' })
// English:  "Welcome, Priya"
// Hindi:    "स्वागत है, प्रिया"
// Gujarati: "આવકાર, પ્રિયા"
```

### Pluralization
Automatic `_one` and `_other` suffix resolution based on numeric counts:
```typescript
tPlural('hospital.bedsAvailableCount', 1) // "1 bed available"
tPlural('hospital.bedsAvailableCount', 5) // "5 beds available"
```

### Locale-Aware Formatting
Formatting dates, times, numbers, and currency is presentation-only using standard `Intl` APIs without mutating underlying canonical database values:
- Number: `1,23,456` (en-IN / hi-IN / gu-IN)
- Date: Medium date style formatted according to current locale.

---

## 6. Strict Medical & Feature Boundaries

1. **Doctor AI Boundary**: Static interface text (headings, buttons, safety disclaimers) is internationalized. Clinical user input, RAG knowledge, AI medical guidance, and backend prompt reasoning remain untampered.
2. **SOS / Emergency Boundary**: Static buttons, instructions, and status labels use i18n. Emergency severity calculation engine, red-flag triage, and hospital dispatch logic remain untouched.
3. **Government Data Boundary**: Source metadata, dataset IDs, raw JSON, and PM-JAY historical records remain untouched in English.
4. **Hospital Matching Boundary**: Step 3 hospital matching logic, entity resolution scores, and audit logging remain 100% untouched.

---

## 7. Verification Summary

- **STEP 4 Test Suite (`step4-i18n.test.js`)**: 40 Passed, 0 Failed.
- **Regression Test Suites**: All passed (Government Data, Directory, Security, Capacity Map, Hospital Matching, Auth Security, Audit DB Integrity).
- **Production Build (`npm run build`)**: Succeeded (2608 modules transformed, 11.06s).
- **Database Baseline**: 26 CareSetu Hospitals, 21 GovernmentHealthRecord, 47 Combined Directory Records intact.
