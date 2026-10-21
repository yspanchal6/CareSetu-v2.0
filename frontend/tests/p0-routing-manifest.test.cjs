const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing Frontend Routing and Manifest Configuration...');

// Test 1: Verify index.html contains absolute /manifest.json link
const indexHtmlPath = path.join(__dirname, '../index.html');
const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

assert(
  indexHtmlContent.includes('<link rel="manifest" href="/manifest.json" />'),
  'frontend/index.html must reference /manifest.json with root-relative path'
);
console.log('  ✅ PASS: frontend/index.html uses root-relative "/manifest.json"');

// Test 1b: Verify index.html contains absolute /favicon.svg link
assert(
  indexHtmlContent.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />'),
  'frontend/index.html must reference /favicon.svg with root-relative path'
);
console.log('  ✅ PASS: frontend/index.html uses root-relative "/favicon.svg"');

// Test 2: Verify manifest.json exists in frontend/public and has valid structure
const manifestPath = path.join(__dirname, '../public/manifest.json');
const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.strictEqual(manifestContent.short_name, 'CareSetu');
assert.strictEqual(manifestContent.start_url, '/');
console.log('  ✅ PASS: frontend/public/manifest.json exists and starts at "/"');

// Test 3: Verify 404.html SPA redirect handles root hosting (Cloudflare Pages) vs subdirectory (GitHub Pages)
const notFoundHtmlPath = path.join(__dirname, '../public/404.html');
const notFoundHtmlContent = fs.readFileSync(notFoundHtmlPath, 'utf8');

assert(
  notFoundHtmlContent.includes('isGitHubPagesSubpath'),
  'frontend/public/404.html must detect GitHub Pages subdirectory'
);
assert(
  notFoundHtmlContent.includes('pathSegmentsToKeep = isGitHubPagesSubpath ? 1 : 0'),
  'frontend/public/404.html must keep 0 path segments on root deployments (Cloudflare Pages)'
);
console.log('  ✅ PASS: frontend/public/404.html dynamically supports Cloudflare root and GitHub Pages subpath');

// Test 4: Verify _redirects maps all routes to index.html with 200 rewrite for Cloudflare Pages
const redirectsPath = path.join(__dirname, '../public/_redirects');
const redirectsContent = fs.readFileSync(redirectsPath, 'utf8').trim();

assert(
  redirectsContent.includes('/* /index.html 200'),
  'frontend/public/_redirects must contain "/* /index.html 200" for Cloudflare Pages SPA rewrite'
);
console.log('  ✅ PASS: frontend/public/_redirects contains "/* /index.html 200"');

console.log('\nAll frontend resource and routing tests passed successfully.');
