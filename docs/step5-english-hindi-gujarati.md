# CARESETU V2.0 — STEP 5: ENGLISH + HINDI + GUJARATI COMPLETION & REFINEMENT DOCUMENTATION

## 1. Overview & Objectives

CareSetu V2.0 Step 5 completes, refines, and hardens the multilingual user experience established in Step 4 for **English (`en`)**, **Hindi (`hi`) — हिन्दी**, and **Gujarati (`gu`) — ગુજરાતી**.

### Core Achievements:
- **100% Key Parity**: 159 required production keys audited and synchronized across `en.json`, `hi.json`, and `gu.json`. Zero missing or stray keys.
- **Placeholder & Pluralization Parity**: Parameter placeholders (`{{name}}`, `{{count}}`) and plural suffix contracts (`_one` / `_other`) match 100% across all 3 locale resources.
- **Production Safe-Fallback System**: Standardized 3-tier fallback (`Selected -> English -> Human-Readable Safe Fallback`) ensuring normal users never see `undefined`, `null`, `[object Object]`, or raw technical key paths.
- **Medical Terminology Safety**: Static interface elements use human-authored translations. Raw clinical data, patient medical records, doctor clinical notes, AI reasoning prompts, emergency severity decision engines, and government metadata remain in English to prevent medical ambiguity.
- **User Workflows & Accessible UI**: Responsive layout handling for longer Hindi/Gujarati text wrapping, reduced-motion compatibility (`prefers-reduced-motion`), and accessible language switching across Guest, Patient, Hospital, and Doctor portals.

---

## 2. Terminology Glossary

| English Term | Hindi Translation (हिन्दी) | Gujarati Translation (ગુજરાતી) | Scope / Context |
|---|---|---|---|
| CareSetu | CareSetu | CareSetu | Brand Name (Unchanged) |
| Emergency SOS | आपातकालीन SOS | ઇમરજન્સી SOS | Static UI Header / SOS Button |
| Report Emergency | आपातकाल की रिपोर्ट करें | ઇમરજન્સી રિપોર્ટ કરો | Action Button |
| Hospital Directory | अस्पताल निर्देशिका | હોસ્પિટલ ડિરેક્ટરી | Public & Patient Navigation |
| Total Beds | कुल बेड: {{count}} | કુલ બેડ: {{count}} | Facility Capacity Label |
| CareSetu Verified | CareSetu सत्यापित | CareSetu ચકાસાયેલ | Verified Network Badge |
| Government Open Data | सरकारी ओपन डेटा | સરકારી ઓપન ડેટા | Open Government Data Badge |
| Doctor AI Assistant | Doctor AI Assistant | Doctor AI Assistant | Static Chat Header |
| Guest Mode | अतिथि मोड | ગેસ્ટ મોડ | Temporary Unauthenticated Session |
| Sign In / Log In | साइन इन करें / लॉग इन | સાઇન ઇન કરો / લોગ ઈન | Authentication Action |
| Register Account | खाता पंजीकृत करें | ખાતું રજીસ્ટર કરો | Registration Action |

---

## 3. Production Fallback System Architecture

```
User selects Language (e.g., 'hi')
             │
             ▼
Look up Key in Selected Locale (hi.json) ──[Found]──► Render Translated Text
             │
         [Missing]
             ▼
Look up Key in English (en.json) ───────────[Found]──► Render English Fallback Text
             │
         [Missing]
             ▼
Human-Readable Key Safe Fallback ───────────────────► Render Human-Readable String
(e.g., 'common.welcomeUser' -> 'Welcome User')       (Never raw key or undefined)
```

---

## 4. Security & Isolation Controls

- **Language Parameter Validation**: Language codes passed via URL, state, or storage are validated against `['en', 'hi', 'gu']`. Injection strings (e.g. `<script>`, path traversal `../`) safely normalize to default `'en'`.
- **Session Isolation**: Guest language preference (`localStorage.getItem('caresetu_lang')`) remains isolated within browser scope. Authenticated user preference restores cleanly upon login and does not leak between user accounts upon logout.
- **Admin Portal Exclusion**: The language selector is conditionally hidden from the Admin topbar to preserve Admin operational workflows and business logic.

---

## 5. Test Suite Summary

- **Step 5 Consistency Test (`step5-consistency.test.js`)**: 30 Passed, 0 Failed.
- **Step 4 i18n Test (`step4-i18n.test.js`)**: 40 Passed, 0 Failed.
- **Full System Regression Suite**: All 140+ assertions across 8 regression test files passed.
- **Production Build (`npm run build`)**: Succeeded cleanly (15.56s).
