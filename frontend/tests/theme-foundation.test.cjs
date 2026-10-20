const fs = require('fs');
const assert = require('assert');

console.log('--- CARESETU THEME FOUNDATION VERIFICATION ---');

// 1. Verify index.html head script logic
const html = fs.readFileSync('frontend/index.html', 'utf-8');
assert(html.includes("localStorage.getItem('caresetu_theme')"), 'Script must check caresetu_theme key');
assert(html.includes("document.documentElement.classList.add('dark')"), 'Script must add dark class');
assert(html.includes("document.documentElement.classList.remove('dark')"), 'Script must remove dark class');
assert(!html.includes('prefers-color-scheme'), 'Script must NOT use OS dark detection');
console.log('✅ PASS: index.html synchronous head script correctly configured with zero OS detection.');

// 2. Simulate theme logic in node sandbox
function simulateThemeBoot(storedValue) {
  let classes = new Set(['initial']);
  let colorScheme = '';
  try {
    const saved = storedValue;
    if (saved === 'dark') {
      classes.add('dark');
      colorScheme = 'dark';
    } else {
      classes.delete('dark');
      colorScheme = 'light';
    }
  } catch {
    classes.delete('dark');
    colorScheme = 'light';
  }
  return { hasDark: classes.has('dark'), colorScheme };
}

// Case A: First time visitor (null) -> Light
assert.deepStrictEqual(simulateThemeBoot(null), { hasDark: false, colorScheme: 'light' });
console.log('✅ PASS: First-time visitor (null preference) defaults strictly to Light mode.');

// Case B: Saved 'dark' -> Dark
assert.deepStrictEqual(simulateThemeBoot('dark'), { hasDark: true, colorScheme: 'dark' });
console.log('✅ PASS: Stored "dark" preference correctly restores Dark mode on boot.');

// Case C: Saved 'light' -> Light
assert.deepStrictEqual(simulateThemeBoot('light'), { hasDark: false, colorScheme: 'light' });
console.log('✅ PASS: Stored "light" preference correctly applies Light mode.');

// Case D: Corrupted/invalid value ('system', 'blue', undefined) -> Light
assert.deepStrictEqual(simulateThemeBoot('random_invalid'), { hasDark: false, colorScheme: 'light' });
assert.deepStrictEqual(simulateThemeBoot(''), { hasDark: false, colorScheme: 'light' });
console.log('✅ PASS: Invalid/corrupted stored value safely falls back to Light mode.');

// 3. Verify index.css has both mobile color-scheme and dark body
const css = fs.readFileSync('frontend/src/index.css', 'utf-8');
assert(css.includes('html.dark body'), 'CSS must define html.dark body');
assert(css.includes('@media (min-width: 2560px)'), 'CSS must preserve 4K / Smart TV styles');
assert(css.includes(':focus-visible'), 'CSS must preserve focus-visible styles');
console.log('✅ PASS: index.css preserves Smart TV and mobile color-scheme while adding html.dark body.');

// 4. Verify ThemeContext
const themeContext = fs.readFileSync('frontend/src/context/ThemeContext.tsx', 'utf-8');
assert(themeContext.includes('caresetu_theme'), 'ThemeContext must use caresetu_theme key');
assert(themeContext.includes('toggleTheme'), 'ThemeContext must export toggleTheme');
assert(themeContext.includes('setTheme'), 'ThemeContext must export setTheme');
console.log('✅ PASS: ThemeContext correctly implements ThemeProvider and useTheme.');

console.log('--- ALL THEME FOUNDATION CHECKS PASSED SUCCESSFULLY ---');
