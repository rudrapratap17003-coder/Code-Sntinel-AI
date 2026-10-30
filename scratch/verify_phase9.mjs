import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

console.log('--- CODESENTINEL AI: PHASE 9 COMPREHENSIVE VERIFICATION ---');

// 1. Verify file presence
const filesToVerify = [
  'src/pages/Login/LoginPage.jsx',
  'src/components/auth/ProtectedRoute.jsx',
  'src/context/AuthContext.jsx',
  'src/layouts/TopNavigation.jsx',
  'src/layouts/Sidebar.jsx',
  'src/routes/AppRoutes.jsx',
  'src/utils/constants.js',
];

for (const relPath of filesToVerify) {
  const fullPath = resolve(process.cwd(), relPath);
  const content = readFileSync(fullPath, 'utf8');
  assert(content.length > 50, `File ${relPath} is empty or unreadable.`);
  console.log(`✓ Verified file existence: ${relPath} (${content.length} bytes)`);
}

// 2. Verify LoginPage requirements
const loginCode = readFileSync(resolve(process.cwd(), 'src/pages/Login/LoginPage.jsx'), 'utf8');

// Check branding & tagline
assert(loginCode.includes('CodeSentinel'), 'LoginPage missing CodeSentinel branding');
assert(loginCode.includes('APP_CONFIG.tagline'), 'LoginPage missing tagline');

// Check input fields
assert(loginCode.includes('type="email"'), 'LoginPage missing email field');
assert(loginCode.includes('password-field'), 'LoginPage missing password field');
assert(loginCode.includes('showPassword') && loginCode.includes('EyeOff'), 'LoginPage missing show/hide password toggle');

// Check Enter Demo Workspace button
assert(loginCode.includes('Enter Demo Workspace'), 'LoginPage missing "Enter Demo Workspace" action');

// Check validation logic
assert(loginCode.includes('validateForm'), 'LoginPage missing field validation logic');
assert(loginCode.includes('Password must be at least 6 characters'), 'LoginPage missing password length validation');

// Check unconfigured auth notice (Strict constraint: do not pretend to validate credentials against real backend)
assert(loginCode.includes('Authentication Service Unconfigured') || loginCode.includes('Production backend authentication is not yet connected'), 'LoginPage missing unconfigured service notice');
assert(!loginCode.includes('localStorage.setItem("password"'), 'Security violation: password stored in localStorage');
assert(!loginCode.includes('sessionStorage.setItem("password"'), 'Security violation: password stored in sessionStorage');
console.log('✓ Verified LoginPage UI controls, validation, security constraints & unconfigured notice');

// 3. Verify AuthContext & Demo Session behavior
const authCode = readFileSync(resolve(process.cwd(), 'src/context/AuthContext.jsx'), 'utf8');
assert(authCode.includes('codesentinel_demo_session_v1'), 'AuthContext missing versioned demo session key');
assert(authCode.includes('enterDemoSession'), 'AuthContext missing enterDemoSession method');
assert(authCode.includes('logout'), 'AuthContext missing logout method');
assert(authCode.includes('DEMO_USER'), 'AuthContext missing DEMO_USER definition');
assert(!authCode.includes('sessionStorage.setItem("password') && !authCode.includes('localStorage.setItem("password'), 'Security violation: password stored in storage');
console.log('✓ Verified AuthContext session management & credential hygiene');

// 4. Verify ProtectedRoute
const protectedCode = readFileSync(resolve(process.cwd(), 'src/components/auth/ProtectedRoute.jsx'), 'utf8');
assert(protectedCode.includes('useAuth'), 'ProtectedRoute does not consume useAuth');
assert(protectedCode.includes('isDemoSession'), 'ProtectedRoute does not verify isDemoSession');
assert(protectedCode.includes('Navigate to={ROUTES.LOGIN}'), 'ProtectedRoute does not redirect to LOGIN');
assert(protectedCode.includes('Client-side route checks are not security boundaries'), 'ProtectedRoute missing required security boundary disclaimer');
console.log('✓ Verified ProtectedRoute guard & transparent security boundary disclaimer');

// 5. Verify AppRoutes protection
const routesCode = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.jsx'), 'utf8');
assert(routesCode.includes('<Route element={<ProtectedRoute />}>'), 'AppRoutes does not wrap dashboard inside ProtectedRoute');
assert(routesCode.includes('path={ROUTES.LOGIN}'), 'AppRoutes missing dedicated /login route');
console.log('✓ Verified AppRoutes structure & protected nesting');

// 6. Verify TopNavigation & Sidebar sign-out actions
const topNavCode = readFileSync(resolve(process.cwd(), 'src/layouts/TopNavigation.jsx'), 'utf8');
assert(topNavCode.includes('logout()') || topNavCode.includes('handleLogout'), 'TopNavigation missing logout invocation');
assert(topNavCode.includes('Sign Out / Exit Demo'), 'TopNavigation missing Sign Out dialog button');

const sidebarCode = readFileSync(resolve(process.cwd(), 'src/layouts/Sidebar.jsx'), 'utf8');
assert(sidebarCode.includes('handleSignOut'), 'Sidebar missing handleSignOut action');
console.log('✓ Verified TopNavigation & Sidebar session sign-out controls');

// 7. Verify Constants
const constantsCode = readFileSync(resolve(process.cwd(), 'src/utils/constants.js'), 'utf8');
assert(constantsCode.includes("LOGIN: '/login'"), 'constants.js missing ROUTES.LOGIN');
console.log('✓ Verified ROUTES.LOGIN constant');

console.log('\n========================================');
console.log('ALL PHASE 9 VERIFICATION CHECKS PASSED!');
console.log('========================================');
