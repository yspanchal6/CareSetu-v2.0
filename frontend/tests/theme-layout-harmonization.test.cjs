const fs = require('fs');
const assert = require('assert');

console.log('--- CARESETU LAYOUT & SHARED SURFACE THEME HARMONIZATION VERIFICATION ---');

// 1. Verify PublicLayout.tsx
const publicLayout = fs.readFileSync('frontend/src/layouts/PublicLayout.tsx', 'utf-8');
assert(publicLayout.includes('dark:bg-slate-950'), 'PublicLayout must support dark background');
assert(publicLayout.includes('dark:text-slate-100'), 'PublicLayout must support dark text');
console.log('✅ PASS: PublicLayout includes dark:bg-slate-950 and dark:text-slate-100.');

// 2. Verify AuthLayout.tsx
const authLayout = fs.readFileSync('frontend/src/layouts/AuthLayout.tsx', 'utf-8');
assert(authLayout.includes('dark:bg-slate-950'), 'AuthLayout must support dark background');
assert(authLayout.includes('dark:bg-slate-900'), 'AuthLayout card must support dark background');
assert(authLayout.includes('dark:border-slate-800'), 'AuthLayout card must support dark borders');
console.log('✅ PASS: AuthLayout includes dark:bg-slate-950 background and dark:bg-slate-900 card.');

// 3. Verify DashboardLayout.tsx
const dashboardLayout = fs.readFileSync('frontend/src/layouts/DashboardLayout.tsx', 'utf-8');
assert(dashboardLayout.includes('dark:bg-slate-950'), 'DashboardLayout must support dark background');
console.log('✅ PASS: DashboardLayout includes dark:bg-slate-950 container.');

// 4. Verify PatientLayout.tsx
const patientLayout = fs.readFileSync('frontend/src/layouts/PatientLayout.tsx', 'utf-8');
assert(patientLayout.includes('dark:bg-slate-950'), 'PatientLayout must support dark background');
console.log('✅ PASS: PatientLayout includes dark:bg-slate-950 container.');

// 5. Verify PublicNavbar.tsx
const publicNavbar = fs.readFileSync('frontend/src/components/layout/PublicNavbar.tsx', 'utf-8');
assert(publicNavbar.includes('dark:bg-slate-900/95'), 'PublicNavbar header must support dark background');
assert(publicNavbar.includes('dark:border-slate-800'), 'PublicNavbar header must support dark border');
assert(publicNavbar.includes('dark:bg-slate-900/98'), 'PublicNavbar mobile drawer must support dark background');
console.log('✅ PASS: PublicNavbar header and mobile drawer include dark:bg-slate-900/95 and borders.');

// 6. Verify Topbar.tsx
const topbar = fs.readFileSync('frontend/src/components/layout/Topbar.tsx', 'utf-8');
assert(topbar.includes('dark:bg-slate-900/95'), 'Topbar header must support dark background');
assert(topbar.includes('dark:border-slate-800'), 'Topbar header must support dark border');
assert(topbar.includes('dark:bg-slate-900'), 'Topbar dropdowns must support dark background');
console.log('✅ PASS: Topbar header and dropdown menus include dark:bg-slate-900 and borders.');

// 7. Verify MobileBottomNav.tsx
const mobileNav = fs.readFileSync('frontend/src/components/layout/MobileBottomNav.tsx', 'utf-8');
assert(mobileNav.includes('dark:bg-slate-900'), 'MobileBottomNav must support dark background');
assert(mobileNav.includes('dark:border-slate-800'), 'MobileBottomNav must support dark border');
console.log('✅ PASS: MobileBottomNav includes dark:bg-slate-900 and dark:border-slate-800.');

// 8. Verify LandingPage.tsx
const landingPage = fs.readFileSync('frontend/src/pages/public/LandingPage.tsx', 'utf-8');
assert(landingPage.includes('dark:bg-slate-950'), 'LandingPage must support dark background');
assert(landingPage.includes('dark:text-slate-100'), 'LandingPage must support dark text');
assert(landingPage.includes('dark:border-slate-800'), 'LandingPage must support dark borders');
console.log('✅ PASS: LandingPage includes dark:bg-slate-950, dark:text-slate-100, and dark:border-slate-800.');

console.log('--- ALL LAYOUT HARMONIZATION CHECKS PASSED SUCCESSFULLY ---');
