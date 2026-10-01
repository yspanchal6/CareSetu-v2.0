# CARESETU — FRONTEND COMPONENT LOCATION MAP
**READ-ONLY CODEBASE AUDIT REPORT**

---

## 1. FRONTEND TREE STRUCTURE

```text
frontend/
├── public/
│   ├── favicon.svg
│   └── vite.svg
├── src/
│   ├── assets/
│   │   └── (Static media assets if referenced)
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── LanguageSelector.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Toast.tsx
│   │   ├── layout/
│   │   │   ├── PublicNavbar.tsx
│   │   │   ├── PublicFooter.tsx
│   │   │   ├── PatientSidebar.tsx
│   │   │   ├── HospitalSidebar.tsx
│   │   │   ├── DoctorSidebar.tsx
│   │   │   └── AdminSidebar.tsx
│   │   └── hospital/
│   │       ├── EmergencyCapacityWidget.tsx
│   │       └── IncomingEmergencyCard.tsx
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   ├── HospitalSecurityContext.tsx
│   │   └── SocketContext.tsx
│   ├── i18n/
│   │   └── I18nContext.tsx
│   ├── layouts/
│   │   ├── PublicLayout.tsx
│   │   ├── AuthLayout.tsx
│   │   ├── PatientLayout.tsx
│   │   └── DashboardLayout.tsx
│   ├── pages/
│   │   ├── public/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── HowItWorksPage.tsx
│   │   │   └── OtherPublicPages.tsx
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── AuthFlowPages.tsx
│   │   │   └── DocumentVerificationPage.tsx
│   │   ├── patient/
│   │   │   ├── PatientDashboard.tsx
│   │   │   ├── EmergencySOSPage.tsx
│   │   │   ├── EmergencyStatusPage.tsx
│   │   │   ├── DoctorAIPage.tsx
│   │   │   └── HealthPackPage.tsx
│   │   ├── hospital/
│   │   ├── doctor/
│   │   └── admin/
│   ├── routes/
│   │   ├── navConfig.ts
│   │   └── ProtectedRoute.tsx
│   ├── services/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── emergency.ts
│   │   └── socket.ts
│   ├── styles/
│   │   └── (Global style files if externalized)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

---

## 2. LANDING PAGE ROOT

**Home Page**
- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Component**: `LandingPage`
- **Route**: `/`
- **Rendered by**: `PublicLayout` (`frontend/src/layouts/PublicLayout.tsx` at line 10)
- **Parent Component**: `App` (`frontend/src/App.tsx` at line 93)
- **Children**:
  - Hero Badge (`Sparkles` icon + `span`)
  - Hero Heading (`h1`)
  - Hero Description (`p`)
  - Hero Buttons (`button` for Report Emergency, `button` for Doctor AI)
  - Micro-flow Pipeline (`div` with `ArrowRight` icons)
  - Right-side Interactive Emergency Orbit (`div` container + `journeySteps.map` + Central SOS `button`)
  - Stats Cards (`section` with `Card` components)
  - Role Selection Onboarding Cards (`section` with `signupRoles.map` + `Card` components)
  - Core Capabilities / Features (`section` with `features.map` + `Card` components)
  - Hospital Network Integration Banner (`section` gradient container)
  - Call To Action (CTA) Section (`section`)

---

## 3. NAVBAR MAP

- **Navbar File**: `frontend/src/components/layout/PublicNavbar.tsx`
- **Navbar Component**: `PublicNavbar`
- **Parent**: `PublicLayout` (`frontend/src/layouts/PublicLayout.tsx` at line 8)

### Navbar Detailed Elements Location Map

1. **Logo & Brand Name**
   - **JSX Location**: `PublicNavbar.tsx#L43-L48`
   - **CSS/Tailwind Styling**: `flex items-center gap-2 shrink-0`, icon box `w-8 h-8 rounded-lg bg-sky flex items-center justify-center`, text `font-extrabold text-navy text-lg tracking-tight`
   - **Hover Styling**: `Link` wrapper (default cursor pointer)
   - **Active Styling**: N/A
   - **Animation**: N/A
   - **Click Handler**: React Router navigation to `/`

2. **Navigation Links (`Home`, `How It Works`, `Features`, `About`, `Contact`)**
   - **JSX Location**: `PublicNavbar.tsx#L50-L64` (Desktop) & `L86-L95` (Mobile drawer)
   - **CSS/Tailwind Styling**: `px-3.5 py-2 rounded-lg text-sm font-medium transition-colors`
   - **Hover Styling**: `hover:text-navy hover:bg-slate-50`
   - **Active Styling**: `text-navy bg-lightblue` (computed dynamically via `isActive` callback)
   - **Animation**: CSS `transition-colors`
   - **Click Handler**: React Router `NavLink` built-in navigation
   - **Navigation Targets**: `/`, `/how-it-works`, `/features`, `/about`, `/contact`

3. **Language Selector**
   - **JSX Location**: `PublicNavbar.tsx#L67` (Desktop) & `L77` (Mobile)
   - **Component**: `LanguageSelector` (`frontend/src/components/common/LanguageSelector.tsx`)
   - **CSS/Tailwind Styling**: Prop `variant="compact"`

4. **Sign In / Login Button**
   - **JSX Location**: `PublicNavbar.tsx#L68-L70` (Desktop) & `L97-L99` (Mobile)
   - **Component**: `Button` (`frontend/src/components/common/Button.tsx`)
   - **CSS/Tailwind Styling**: `variant="ghost"` (Desktop) / `variant="outline"` (Mobile), `size="sm"`
   - **Click Handler**: `onClick={() => navigate("/login")}`
   - **Navigation Target**: `/login`

5. **Report Emergency Button (Navbar)**
   - **JSX Location**: `PublicNavbar.tsx#L71-L73` (Desktop) & `L100-L102` (Mobile)
   - **Component**: `Button` (`frontend/src/components/common/Button.tsx`)
   - **CSS/Tailwind Styling**: `variant="danger" size="sm"` (`bg-emergency hover:bg-emergency-dark text-white font-bold rounded-xl`)
   - **Hover Styling**: `hover:bg-emergency-dark`
   - **Click Handler**: `onClick={handleEmergencyClick}` (`PublicNavbar.tsx#L24-L38`)
   - **State**: `loadingEmergency` (boolean)
   - **Guest Session Logic**: Checks `!isAuthenticated`. If true, awaits `startGuestSession()` from `AuthContext`, then navigates to `/patient/emergency`.

---

## 4. HERO BADGE

- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Component**: `LandingPage`
- **JSX Location**: `LandingPage.tsx#L162-L165`
- **Text**: `"Emergency care coordination"`
- **Styles**: `inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200/80 text-sky-700 text-xs font-semibold tracking-tight shadow-2xs`
- **Icon**: `Sparkles` (`lucide-react`, line 163) styled with `w-3.5 h-3.5 text-sky-500`
- **Animation**: N/A

---

## 5. HERO HEADING

- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Component**: `LandingPage`
- **Exact JSX**: `LandingPage.tsx#L167-L173`
  ```tsx
  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.08] tracking-tight">
    Right Care.
    <br />
    Right Time.
    <br />
    Right Place.
  </h1>
  ```
- **Typography Classes**: `text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.08] tracking-tight`
- **Font**: `"Manrope", "Inter", system-ui, sans-serif` (configured in `tailwind.config.js#L32-L34` & `index.css#L16`)
- **Font Size**: Mobile `text-4xl` (36px), Tablet `sm:text-5xl` (48px), Desktop `lg:text-6xl` (60px)
- **Font Weight**: `font-black` (weight 900)
- **Line Height**: `leading-[1.08]`
- **Responsive Classes**: `sm:text-5xl lg:text-6xl`
- **Animation**: N/A

### Manual Edit Recommendations for Heading
- **Larger size**: Change `text-4xl sm:text-5xl lg:text-6xl` to `text-5xl sm:text-6xl lg:text-7xl`
- **Smaller size**: Change `text-4xl sm:text-5xl lg:text-6xl` to `text-3xl sm:text-4xl lg:text-5xl`
- **Darker color**: Change `text-slate-900` to `text-black` or `text-navy-dark`
- **Lighter color**: Change `text-slate-900` to `text-slate-700` or `text-navy-light`
- **More line spacing**: Change `leading-[1.08]` to `leading-tight` or `leading-normal`
- **Different font weight**: Change `font-black` to `font-extrabold` (800) or `font-bold` (700)

---

## 6. HERO DESCRIPTION

- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Component**: `LandingPage`
- **Text Location**: `LandingPage.tsx#L175-L177`
- **Text Content**: `"CareSetu connects patients with the right healthcare facility during emergencies using intelligent hospital matching, secure health information sharing, and AI-assisted coordination."`
- **Width**: `max-w-xl`
- **Font Size**: Mobile `text-base` (16px), Tablet/Desktop `sm:text-lg` (18px)
- **Line Height**: `leading-relaxed`
- **Color**: `text-slate-600`
- **Responsive Behavior**: `text-base sm:text-lg`
- **Animation**: N/A

---

## 7. REPORT EMERGENCY BUTTON MAP

### A. Hero Report Emergency Button
- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Component**: `LandingPage`
- **JSX Location**: `LandingPage.tsx#L181-L189`
- **CSS/Tailwind**: `group relative inline-flex items-center justify-center gap-3 px-7 py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-base shadow-lg shadow-rose-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-rose-500/30`
- **Icon**: `Phone` (`lucide-react`, line 187) `w-5 h-5`
- **Click Handler**: `onClick={handleEmergencyClick}` (`LandingPage.tsx#L109-L123`)
- **Navigation**: `/patient/emergency`
- **API/Guest Session**: `if (!isAuthenticated) await startGuestSession();`
- **Hover**: `hover:bg-rose-700 hover:scale-[1.02]`
- **Active**: `active:scale-[0.98]`
- **Animation**: `transition-all duration-200`

### B. Navbar Report Emergency Button
- **File**: `frontend/src/components/layout/PublicNavbar.tsx`
- **Component**: `PublicNavbar`
- **JSX Location**: `PublicNavbar.tsx#L71-L73` (Desktop) & `L100-L102` (Mobile)
- **CSS/Tailwind**: Handled via `Button` component (`variant="danger" size="sm"`) -> `bg-emergency hover:bg-emergency-dark text-white font-bold rounded-xl`
- **Icon**: None in Navbar button (Text only: `t("emergency.reportEmergency")`)
- **Click Handler**: `onClick={handleEmergencyClick}` (`PublicNavbar.tsx#L24-L38`)
- **Navigation**: `/patient/emergency`
- **API/Guest Session**: Awaits `startGuestSession()` if unauthenticated.
- **Hover**: `hover:bg-emergency-dark`
- **Active**: Button default active state
- **Animation**: CSS `transition-colors`

---

## 8. DOCTOR AI BUTTON

- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Component**: `LandingPage`
- **JSX Location**: `LandingPage.tsx#L191-L199`
- **Styles**: `group inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-base shadow-md border border-slate-800 hover:border-sky-400 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-sky-500/30`
- **Icon**: `BrainCircuit` (`lucide-react`, line 197) styled with `w-5 h-5 text-sky-400 group-hover:rotate-12 transition-transform duration-300`
- **Click Handler**: `onClick={handleDoctorAiClick}` (`LandingPage.tsx#L125-L139`)
- **Navigation**: `/patient/doctor-ai`
- **Guest Session Logic**: If `!isAuthenticated`, awaits `startGuestSession()`.
- **Hover**: `hover:bg-slate-800 hover:border-sky-400 hover:scale-[1.02]`, icon rotates 12deg (`group-hover:rotate-12`)
- **Animation**: `transition-all duration-200` on button, `transition-transform duration-300` on icon

---

## 9. WORKFLOW LINE

- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Component**: `LandingPage`
- **JSX Location**: `LandingPage.tsx#L203-L213`
- **Items & Colors**:
  1. `"Patient"`: `text-slate-800 font-bold` (L204)
  2. `"Emergency"`: `text-rose-600 font-bold` (L206)
  3. `"Smart Matching"`: `text-sky-600 font-bold` (L208)
  4. `"Hospital"`: `text-slate-800 font-bold` (L210)
  5. `"Doctor"`: `text-slate-800 font-bold` (L212)
- **Arrow Component**: `ArrowRight` (`lucide-react`, L205, L207, L209, L211) styled with `w-3.5 h-3.5 text-slate-300`
- **Spacing**: `gap-2 pt-3 flex-wrap`
- **Hover**: N/A
- **Animation**: N/A

---

## 10. RIGHT-SIDE EMERGENCY ORBIT MAP

- **Main Orbit Component**: Implemented inline inside `LandingPage.tsx`
- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Parent**: Hero Section (`LandingPage.tsx#L217-L267`)
- **CSS**: `lg:col-span-6 relative aspect-square max-w-md mx-auto w-full transition-transform duration-300 ease-out`

### Individual Orbit Nodes Map (`journeySteps` array at `LandingPage.tsx#L26-L33`)

1. **Report Emergency Node**
   - **File**: `LandingPage.tsx#L27, L234-L250`
   - **Icon**: `Phone`
   - **Position**: Trigonometric angle `(0/6)*2π - π/2` (Top center: X: 50%, Y: 8%)
   - **CSS/Tailwind**: Circle `w-12 h-12 rounded-2xl bg-white text-sky-600 border-slate-200/80 group-hover:border-sky-400 group-hover:shadow-md`, Label `text-[11px] font-bold bg-white text-slate-800 border-slate-200/60 shadow-2xs`
   - **Hover**: `hover:scale-105`, icon turns `text-sky-500`
   - **Click Handler**: None (Static workflow visual)
   - **State**: None
   - **Animation**: Continuous parent spin `animate-[spin_60s_linear_infinite]`, node counter-spin `animate-[spin_60s_linear_infinite_reverse]`

2. **Capture Location Node**
   - **File**: `LandingPage.tsx#L28, L234-L250`
   - **Icon**: `MapPin`
   - **Position**: Trigonometric angle `(1/6)*2π - π/2` (Top right: X: 86.37%, Y: 29%)
   - **Hover**: `hover:scale-105`
   - **Click Handler**: None
   - **State**: None

3. **AI Case Structuring Node**
   - **File**: `LandingPage.tsx#L29, L234-L250`
   - **Icon**: `BrainCircuit`
   - **Position**: Trigonometric angle `(2/6)*2π - π/2` (Bottom right: X: 86.37%, Y: 71%)
   - **Hover**: `hover:scale-105`
   - **Click Handler**: None
   - **State**: None

4. **Find Hospital Node**
   - **File**: `LandingPage.tsx#L30, L234-L250`
   - **Icon**: `Search`
   - **Position**: Trigonometric angle `(3/6)*2π - π/2` (Bottom center: X: 50%, Y: 92%)
   - **Hover**: `hover:scale-105`
   - **Click Handler**: None
   - **State**: None

5. **Hospital Accepts Node**
   - **File**: `LandingPage.tsx#L31, L234-L250`
   - **Icon**: `CheckCircle2`
   - **Position**: Trigonometric angle `(4/6)*2π - π/2` (Bottom left: X: 13.63%, Y: 71%)
   - **Hover**: `hover:scale-105`
   - **Click Handler**: None
   - **State**: None

6. **Patient Transfer Node**
   - **File**: `LandingPage.tsx#L32, L234-L250`
   - **Icon**: `Ambulance`
   - **Position**: Trigonometric angle `(5/6)*2π - π/2` (Top left: X: 13.63%, Y: 29%)
   - **Hover**: `hover:scale-105`
   - **Click Handler**: None
   - **State**: None

---

## 11. CENTRAL SOS HUB

- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Component**: `LandingPage`
- **JSX Location**: `LandingPage.tsx#L253-L266`
- **Icon**: `Ambulance` (`lucide-react`, L262) styled with `w-8 h-8 text-white group-hover:animate-pulse`
- **Background**: `bg-rose-600`
- **Glow / Shadow**: `shadow-lg shadow-rose-600/30`
- **Pulse Animation**: `<span className="animate-ping absolute inset-0 rounded-full bg-rose-500/40 duration-1000" />`
- **Animation Duration**: 1000ms (`duration-1000`)
- **Click Handler**: `onClick={handleEmergencyClick}` (L259)
- **State**: Uses `loadingAction` (`"emergency"`)

### Where to Manually Edit SOS Hub
- **SOS Size**: `LandingPage.tsx#L260` -> Change `w-20 h-20`
- **SOS Color**: `LandingPage.tsx#L260` -> Change `bg-rose-600`
- **SOS Glow**: `LandingPage.tsx#L260` -> Change `shadow-rose-600/30`
- **SOS Pulse Speed**: `LandingPage.tsx#L256` -> Change `duration-1000` or keyframe `animate-ping`
- **SOS Icon Size**: `LandingPage.tsx#L262` -> Change `w-8 h-8`

---

## 12. ORBIT CIRCLE SYSTEM

- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Outer Dashed Circle**: `LandingPage.tsx#L222` -> `absolute inset-0 rounded-full border border-dashed border-sky-300/40 animate-[spin_60s_linear_infinite]`
- **Inner Circle**: `LandingPage.tsx#L223` -> `absolute inset-8 rounded-full border border-slate-200/80 animate-[spin_40s_linear_infinite_reverse]`
- **Orbit Container**: `LandingPage.tsx#L226` -> `absolute inset-0 animate-[spin_60s_linear_infinite]`
- **Node Positioning**: Computed in JavaScript at runtime: `r = 42`, `x = 50 + r * cos(angle)`, `y = 50 + r * sin(angle)` (`LandingPage.tsx#L228-L231`)
- **Dash Animation**: Native browser CSS SVG/Border rendering
- **Rotation Animation**: Tailwind arbitrary keyframe class `animate-[spin_60s_linear_infinite]`

---

## 13. ORBIT ROTATION DETAILS

- **Main Rotation Animation**: `animate-[spin_60s_linear_infinite]`
- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Line**: Line 222 & Line 226
- **Duration**: 60s
- **Timing Function**: `linear`
- **Iteration**: `infinite`
- **Counter-Rotation (Keeps text/icons upright)**: `animate-[spin_60s_linear_infinite_reverse]`
- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Line**: Line 240
- **Duration**: 60s
- **Direction**: `reverse`

---

## 14. ORBIT NODE ACTIVE STATE AUDIT

- **Active State Variable**: NONE in `LandingPage.tsx` (Nodes are rendered as pure, static workflow indicators).
- **Click-based Node State**: Intentionally removed/absent to prevent permanent node highlighting.

---

## 15. ORBIT CLICK EVENTS SEARCH RESULTS

Audit across entire `frontend/src`:
- `onClick` on Orbit Nodes: **NOT FOUND** (Nodes have no `onClick` binding).
- Only the **Central SOS Button** (`LandingPage.tsx#L259`) has an `onClick={handleEmergencyClick}` event.

---

## 16. ORBIT HOVER

- **Implementation**: Pure Tailwind CSS pseudo-class `:hover`
- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Line**: Line 236 (`group hover:scale-105`), Line 241 (`group-hover:border-sky-400 group-hover:shadow-md`), Line 242 (`group-hover:text-sky-500`)
- **Scale**: `scale-105` (1.05x zoom on hover)
- **Shadow**: `shadow-md`
- **Color**: Border changes to `border-sky-400`, icon color changes to `text-sky-500`
- **Transition Duration**: `duration-300` (300ms)

---

## 17. MOUSE / PARALLAX INTERACTION MAP

- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Event Listener**: `onMouseMove={handleMouseMove}` attached to Hero `<section>` (`LandingPage.tsx#L146`)
- **State/Ref**: `mousePos` state (`useState({ x: 0, y: 0 })`, L97), `heroRef` (`useRef<HTMLDivElement>(null)`, L98)
- **Effect**: Calculates offset `x` and `y` normalized to `[-10, 10]` range.
- **Elements Affected**:
  1. Top-left light blue atmosphere sphere (`LandingPage.tsx#L152`): `transform: translate(${mousePos.x * 0.3}px, ${mousePos.y * 0.3}px)`
  2. Top-right rose atmosphere sphere (`LandingPage.tsx#L156`): `transform: translate(${-mousePos.x * 0.3}px, ${-mousePos.y * 0.3}px)`
  3. Right-side Emergency Orbit container (`LandingPage.tsx#L219`): `transform: translate(${mousePos.x * -0.2}px, ${mousePos.y * -0.2}px)`

---

## 18. NAVBAR ANIMATIONS

- **Entrance Animation**: CSS sticky header transition (`sticky top-0 z-40 bg-white/90 backdrop-blur`)
- **Hover Animation**: Links transition color via `transition-colors hover:bg-slate-50`
- **Logo Animation**: None
- **Mobile Menu Drawer**: Toggled via React state `open` with conditional render (`PublicNavbar.tsx#L84`)

---

## 19. HERO ENTRANCE ANIMATION

- **Badge**: Standard static render
- **Heading**: Standard static render
- **Description**: Standard static render
- **Buttons**: Micro scale feedback on hover (`hover:scale-[1.02]`) and click (`active:scale-[0.98]`)
- **Orbit Container**: Continuous CSS spin (`animate-[spin_60s_linear_infinite]`)

---

## 20. SCROLL ANIMATIONS

- **Library**: CSS native transitions & sticky utilities (`backdrop-blur`)
- **IntersectionObserver / framer-motion**: NOT FOUND in `LandingPage.tsx` (Ensures lightweight, high-performance rendering).

---

## 21. CSS / TAILWIND LOCATION

- Primary styling approach: **Tailwind CSS utility classes** combined with custom keyframes defined in `tailwind.config.js` and `index.css`.
- Global CSS file: `frontend/src/index.css`
- Config file: `frontend/tailwind.config.js`

---

## 22. GLOBAL CSS AUDIT (`frontend/src/index.css`)

- **File**: `frontend/src/index.css`
- **`body` & `html`**: `height: 100%`, `background: #F8FAFC`, `color: #1E293B`, `font-family: "Manrope", "Inter", system-ui, sans-serif`
- **Google Fonts Import**: `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');` (Line 1)
- **Custom Scrollbar**: `.scrollbar-thin` (Lines 29-37)

---

## 23. ANIMATION KEYFRAMES TABLE

| Animation Name | Source File | Line | Used By | Purpose |
|---|---|---|---|---|
| `spin` | Tailwind Default | - | `LandingPage.tsx#L222` | Rotates outer orbit ring & orbit container |
| `spin (reverse)` | Tailwind Default | - | `LandingPage.tsx#L223, L240` | Counter-rotates orbit nodes to keep labels upright |
| `ping` | Tailwind Default | - | `LandingPage.tsx#L256` | Continuous pulse ring around Central SOS button |
| `pulseRing` | `tailwind.config.js` / `index.css` | `L46` / `L51` | Utility `.animate-pulseRing` | Expanding box-shadow pulse |
| `slideUp` | `tailwind.config.js` / `index.css` | `L50` / `L39` | Utility `.animate-slideUp` | Entrance modal/card slide up |
| `scaleUp` | `tailwind.config.js` | `L54` | Utility `.animate-scaleUp` | Pop-in dialog animation |
| `shake` | `tailwind.config.js` / `index.css` | `L58` / `L76` | Utility `.animate-shake` | Red emergency rejection shake |
| `bluePulse` | `index.css` | `L105` | Utility `.animate-blue-pulse` | Active emergency stage ring pulse |
| `radiusExpand` | `index.css` | `L132` | Utility `.animate-radius-expand` | Radar search ring expansion |
| `heartbeat` | `index.css` | `L194` | Utility `.animate-heartbeat` | ECG heartbeat rhythm |
| `ambulanceMove`| `index.css` | `L238` | Utility `.animate-ambulance` | En-route ambulance telemetry movement |

---

## 24. LANDING PAGE ICONS MAP (`lucide-react`)

- `Sparkles`: `LandingPage.tsx#L17, L163` -> Hero Badge
- `Phone`: `LandingPage.tsx#L3, L27, L37, L187` -> Hero Report Emergency Button & Features
- `BrainCircuit`: `LandingPage.tsx#L5, L29, L197` -> Hero Doctor AI Button
- `MapPin`: `LandingPage.tsx#L4, L28, L44` -> Orbit Node & Smart Matching Feature
- `Search`: `LandingPage.tsx#L6, L30` -> Orbit Node (Find Hospital)
- `CheckCircle2`: `LandingPage.tsx#L7, L31, L395` -> Orbit Node & Hospital Features
- `Ambulance`: `LandingPage.tsx#L8, L32, L262` -> Central SOS Button & Orbit Node
- `ArrowRight`: `LandingPage.tsx#L10, L205-L211, L319` -> Micro Flow & Card Buttons
- `HeartPulse`: `PublicNavbar.tsx#L3, L45` -> Navbar Brand Logo

---

## 25. FONTS

- **Font Family**: Manrope & Inter
- **Source**: Google Fonts CDN (`index.css#L1`)
- **Tailwind Configuration**: `tailwind.config.js#L32-L34`
  ```js
  fontFamily: {
    sans: ["Manrope", "Inter", "system-ui", "sans-serif"],
  }
  ```

---

## 26. COLOR PALETTE MAP

| Role | Color Name | Hex / Tailwind Class | File Usage |
|---|---|---|---|
| **Dark Navy** | Navy Base | `#0B2545` (`text-navy`, `bg-navy`) | Navbar logo, headers, buttons |
| **Dark Navy (Dark)**| Navy Dark | `#07172C` (`bg-navy-dark`) | Dark sections, hospital banner |
| **Healthcare Blue** | Sky / Primary | `#0EA5E9` (`bg-sky`, `text-sky-600`) | Orbit nodes, icons, badges |
| **Light Blue** | Sky Light | `#E0F2FE` (`bg-sky-50`, `bg-lightblue`) | Card backgrounds, active nav links |
| **Emergency Red** | Emergency Red | `#DC2626` / `#E11D48` (`bg-rose-600`, `bg-emergency`)| Report Emergency, SOS Hub |
| **Background** | Slate 50 | `#F8FAFC` (`bg-white`, `bg-slate-50`) | Body background |

---

## 27. RESPONSIVE BREAKPOINTS MAP

- **Mobile (<640px)**: 1-column hero layout, text-4xl heading, compact navbar menu drawer.
- **Tablet (640px - 1024px)**: `sm:text-5xl` heading, 2-column stats grid.
- **Desktop (>=1024px)**: `lg:grid-cols-12` split layout (6-col left hero text, 6-col right orbit), desktop navbar menu visible.

---

## 28. ASSET MAP

- **Favicon**: `public/favicon.svg` -> HTML tab icon
- **Vite Logo**: `public/vite.svg` -> Build template asset

---

## 29. COMPONENT DEPENDENCY MAP

```text
App (frontend/src/App.tsx)
└── BrowserRouter
    └── Routes
        └── Route [element=<PublicLayout />] (frontend/src/layouts/PublicLayout.tsx)
            ├── PublicNavbar (frontend/src/components/layout/PublicNavbar.tsx)
            │   ├── Link / NavLink (react-router-dom)
            │   ├── HeartPulse / Menu / X (lucide-react)
            │   ├── LanguageSelector (frontend/src/components/common/LanguageSelector.tsx)
            │   └── Button (frontend/src/components/common/Button.tsx)
            ├── Outlet -> LandingPage (frontend/src/pages/public/LandingPage.tsx)
            │   ├── Hero Section
            │   │   ├── Sparkles Badge
            │   │   ├── Heading & Description
            │   │   ├── Action Buttons (Report Emergency & Doctor AI)
            │   │   ├── Micro Flow Pipeline (ArrowRight)
            │   │   └── Emergency Orbit System
            │   │       ├── Outer Dashed Ring
            │   │       ├── Rotating Node Container (journeySteps)
            │   │       └── Central SOS Hub Button
            │   ├── Stats Cards (Card component)
            │   ├── Role Selection Cards (Card component + Button component)
            │   ├── Core Capabilities / Features (Card component)
            │   ├── Hospital Network Banner
            │   └── Call To Action (CTA) Section
            └── PublicFooter (frontend/src/components/layout/PublicFooter.tsx)
```

---

## 30. MANUAL EDIT GUIDE

### Want to change Hero heading size:
- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Line**: Line 167
- **Current class**: `text-4xl sm:text-5xl lg:text-6xl`
- **What to edit**: Modify Tailwind size classes (e.g. to `text-5xl sm:text-6xl lg:text-7xl`).

### Want to change Orbit rotation speed:
- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Lines**: Line 222, Line 226, Line 240
- **Current duration**: `animate-[spin_60s_linear_infinite]` and `animate-[spin_60s_linear_infinite_reverse]`
- **What to edit**: Replace `60s` with your desired duration (e.g., `45s` or `80s`). Ensure both the outer spin and counter-spin durations match to keep labels upright.

### Want to change Central SOS pulse speed & glow:
- **File**: `frontend/src/pages/public/LandingPage.tsx`
- **Lines**: Line 256 (`animate-ping duration-1000 bg-rose-500/40`), Line 260 (`shadow-rose-600/30`)
- **What to edit**: Change `duration-1000` or the background opacity/color for glow intensity.

### Want to change Report Emergency button color:
- **Hero Button**: `frontend/src/pages/public/LandingPage.tsx` at line 185 -> change `bg-rose-600 hover:bg-rose-700`
- **Navbar Button**: `frontend/tailwind.config.js` at line 29 -> edit `emergency: { DEFAULT: "#DC2626" }`

### Want to change Doctor AI button styling:
- **File**: `frontend/src/pages/public/LandingPage.tsx` at line 195
- **Current class**: `bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-sky-400`
- **What to edit**: Replace slate background or border hover colors as needed.

---

## 31. READ-ONLY AUDIT VERIFICATION

This codebase audit has been conducted strictly in READ-ONLY mode.
- No files were edited, refactored, renamed, or moved.
- No packages were added or removed.
- No UI, animation, or functionality changes were applied.
- No Git commit, push, or deployment commands were run.
