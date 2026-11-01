const fs = require('fs');
const assert = require('assert');

console.log('--- CARESETU NAVIGATION THEME TOGGLE VERIFICATION ---');

// 1. Verify PublicNavbar.tsx integration
const publicNavbar = fs.readFileSync('frontend/src/components/layout/PublicNavbar.tsx', 'utf-8');
assert(publicNavbar.includes('import ThemeToggle from "../common/ThemeToggle";'), 'PublicNavbar must import ThemeToggle');
const occurrences = (publicNavbar.match(/<ThemeToggle size="sm" \/>/g) || []).length;
assert.strictEqual(occurrences, 2, 'ThemeToggle must appear twice in PublicNavbar (desktop cluster and mobile header)');
console.log('✅ PASS: PublicNavbar correctly mounts ThemeToggle in both desktop and mobile header clusters.');

// 2. Verify Topbar.tsx integration
const topbar = fs.readFileSync('frontend/src/components/layout/Topbar.tsx', 'utf-8');
assert(topbar.includes('import ThemeToggle from "../common/ThemeToggle";'), 'Topbar must import ThemeToggle');
assert(topbar.includes('<ThemeToggle size="sm" />'), 'Topbar must mount ThemeToggle in actions cluster');
console.log('✅ PASS: Shared Topbar correctly mounts ThemeToggle in header action cluster.');

console.log('--- ALL NAVIGATION THEME TOGGLE CHECKS PASSED ---');
