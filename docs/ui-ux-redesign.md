# CareSetu V2.0 — Website UI/UX Redesign & Design System Architecture

## Overview
CareSetu V2.0 is an AI-integrated healthcare and emergency platform. This document outlines the comprehensive UI/UX redesign, design tokens, component architecture, responsive behavior, animation system, accessibility guidelines, and multilingual user experience refinements implemented across the application.

---

## 1. Core Design System & Tokens

### Palette & Semantic Healthcare Colors
CareSetu's design system uses curated semantic healthcare colors engineered for high contrast, legibility, and calm professionalism:

- **Primary Slate / Surface**: `slate-950` (#080D1A), `slate-900` (#0F172A), `slate-800` (#1E293B), `slate-50` (#F8FAFC).
- **Medical Primary**: `sky-500` (#0EA5E9) with hover `sky-600` (#0284C7) and light tint `sky-50` (#F0F9FF).
- **Navy Deep**: `navy` (#0B2545) for header background, dark sidebars, and structural framing.
- **Success / Verified**: `emerald-600` (#10B981) for verified network hospitals, matched entities, and active statuses.
- **Warning / Medium Confidence**: `amber-500` (#F59E0B) for candidate conflicts, pending reviews, and offline notices.
- **Emergency / Critical**: `rose-600` / `red-600` (#DC2626) with glow shadow (`shadow-emergency`) for emergency SOS triggers and red-flag alerts.

### Typography & Spacing
- **Font Stack**: `"Manrope", "Inter", "Noto Sans Devanagari", "Noto Sans Gujarati", "Hind", "Shruti", system-ui, sans-serif`.
- **Rhythm**: 8px spatial grid scale (`gap-2`, `gap-3`, `gap-4`, `p-4`, `p-6`, `rounded-2xl`).

---

## 2. Shared App Shell & Navigation

- **Desktop Layout**: Collapsible sidebar with active page indicators, role pills, pending deletion badge counters, and topbar user drop-down with language selector.
- **Mobile Layout**: Responsive top bar, collapsible mobile navigation drawer, touch-friendly tap targets, and no horizontal overflow.

---

## 3. Redesigned Admin Hospital Matching (`/admin/hospital-matching`)

### Key Enhancements
1. **Header & Context**:
   - Header with title, subtitle, help icon explaining candidate evaluation algorithm, and "Run Candidate Evaluation" action button with loading spinner.
2. **Statistics Cards Grid**:
   - Real-time KPI breakdown cards for *Gov Records*, *Pending*, *High Conf.*, *Med Conf.*, *Low Conf.*, *Matched*, *Rejected*, and *Unmatched*.
3. **Filter Toolbar**:
   - Responsive filter bar featuring live text search, status dropdown, confidence dropdown, state selector, and mobile toggle drawer.
4. **Candidate Cards Visual Flow**:
   - 3-step visual cards (`Government Record` → `Match Distance & Confidence Level` → `CareSetu Network Hospital`).
   - Explicit evidence badges (`✓ Same State (Delhi)`, `✓ Geographic Proximity (3.88 km apart)`, `⚠ District Mismatch`).
   - "Side-by-Side Review" trigger button.
5. **Side-by-Side Review Modal ("Candidate Entity Resolution")**:
   - Split 2-column view comparing Government data vs. CareSetu hospital fields (Name, Facility Type, State/District, Pincode, Coordinates, Phone, Address).
   - "Why this candidate was suggested" breakdown section outlining positive evidence vs. potential conflicts.
   - Immediate actions: *Approve & Link Entity*, *Reject Match*, *Unlink Relationship*, with mandatory audit reason modal for rejections.

---

## 4. Doctor AI & Emergency SOS UI

### Doctor AI Assistant (`/patient/doctor-ai`)
- Medical assistant identity header ("CareSetu Doctor AI").
- Clean message stream with assistant identity bubbles, user input bubbles, typing/thinking indicator, quick starter prompts, and voice symptom input.
- Offline detector notification with retry options.

### Emergency SOS Trigger (`/patient/emergency`)
- Immediate high-contrast emergency screen.
- Non-delayed single-tap SOS button with surrounding radar ripple animation during location capture.
- Status steps: *locating* → *creating* → *created* (with public Case ID) → *queued* (offline mode with phone fallbacks to 108/112).

---

## 5. Micro-Interactions, Motion & Accessibility

- **GPU-Friendly CSS Keyframe Animations**: `fadeIn`, `slideUp`, `scaleUp`, `checkPop`, `xPop`, `radiusExpand`, `pulseRing`.
- **Accessibility & WCAG 2.2 AA**:
  - Focus rings (`:focus-visible` with `outline: 2px solid #0EA5E9`).
  - Screen-reader labels (`aria-label`, `aria-disabled`, `aria-busy`).
- **Reduced Motion Support**: `@media (prefers-reduced-motion: reduce)` removes non-essential animations.

---

## 6. Multilingual Architecture (12 Indian Languages)

- Supported languages: `en`, `hi`, `gu`, `mr`, `bn`, `ta`, `te`, `kn`, `ml`, `pa`, `or`, `as`.
- All static strings use `i18n` translations via `useTranslation()`.
- Flexible container layouts prevent text overflow when rendering long translations.
