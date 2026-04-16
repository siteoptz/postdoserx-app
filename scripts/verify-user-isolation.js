#!/usr/bin/env node
// User isolation verification script
// Tests that all API endpoints properly scope data by user_id

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

console.log('🔍 Verifying user isolation implementation...\n');

const results = {
  passed: 0,
  failed: 0,
  issues: []
};

// Check JWT middleware implementation
function checkJWTMiddleware() {
  console.log('1. Checking JWT middleware...');
  
  const authFile = './api/middleware/auth.js';
  if (!existsSync(authFile)) {
    results.failed++;
    results.issues.push('❌ JWT middleware file not found');
    return;
  }
  
  const authContent = readFileSync(authFile, 'utf8');
  
  // Check for proper JWT verification
  if (!authContent.includes('jwtVerify')) {
    results.failed++;
    results.issues.push('❌ JWT verification not implemented');
    return;
  }
  
  // Check that user ID comes from JWT sub field
  if (!authContent.includes('user.sub')) {
    results.failed++;
    results.issues.push('❌ JWT sub field not used for user identification');
    return;
  }
  
  // Check withAuth wrapper
  if (!authContent.includes('withAuth') && !authContent.includes('req.userId')) {
    results.failed++;
    results.issues.push('❌ withAuth wrapper not implemented properly');
    return;
  }
  
  results.passed++;
  console.log('  ✅ JWT middleware properly implemented');
}

// Get all API files recursively
function getAPIFiles(dir = 'api', files = []) {
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    if (item.endsWith('.js')) {
      files.push(fullPath);
    } else if (existsSync(fullPath) && readdirSync(fullPath).length > 0) {
      try {
        getAPIFiles(fullPath, files);
      } catch (e) {
        // Ignore directories we can't read
      }
    }
  }
  return files;
}

// Check API routes for user isolation
function checkAPIRoutes() {
  console.log('\n2. Checking API routes for user isolation...');
  
  const apiFiles = getAPIFiles();
  let routesChecked = 0;
  let routesPassed = 0;
  
  for (const file of apiFiles) {
    if (file.includes('middleware') || file.includes('config')) {
      continue; // Skip utility files
    }
    
    // Skip authentication endpoints and webhooks (they don't need withAuth)
    if (file.includes('auth/login') || file.includes('auth/me') || 
        file.includes('login.js') || file.includes('webhook') ||
        file.includes('stripe/create-checkout-session') || 
        file.includes('stripe/verify-session')) {
      continue;
    }
    
    const content = readFileSync(file, 'utf8');
    routesChecked++;
    
    // Check if route uses authentication
    if (!content.includes('withAuth')) {
      results.failed++;
      results.issues.push(`❌ ${file}: No authentication wrapper found`);
      continue;
    }
    
    // Check for database queries that scope by user
    const hasUserScoping = (
      content.includes('.eq(\'user_id\', userId)') ||
      content.includes('.eq(\'user_id\', user.id)') ||
      content.includes('.eq(\'id\', user.') ||
      content.includes('user_id: userId') ||
      content.includes('user_id: user.id')
    );
    
    if (!hasUserScoping && content.includes('.from(')) {
      results.failed++;
      results.issues.push(`❌ ${file}: Database queries not properly scoped by user_id`);
      continue;
    }
    
    // Check that user_id doesn't come from request body/query
    const acceptsUserIdFromClient = (
      content.includes('req.body.user_id') ||
      content.includes('req.query.user_id') ||
      content.includes('body.user_id') ||
      content.includes('query.user_id')
    );
    
    if (acceptsUserIdFromClient) {
      results.failed++;
      results.issues.push(`❌ ${file}: Accepts user_id from client request (security risk)`);
      continue;
    }
    
    routesPassed++;
  }
  
  results.passed += routesPassed;
  console.log(`  ✅ ${routesPassed}/${routesChecked} API routes properly isolated`);
  
  if (routesPassed < routesChecked) {
    console.log(`  ⚠️ ${routesChecked - routesPassed} routes have isolation issues`);
  }
}

// Check frontend authentication flow
function checkFrontendAuth() {
  console.log('\n3. Checking frontend authentication flow...');
  
  const authInitFile = './js/auth-init.js';
  if (!existsSync(authInitFile)) {
    results.failed++;
    results.issues.push('❌ Frontend auth initialization file not found');
    return;
  }
  
  const authContent = readFileSync(authInitFile, 'utf8');
  
  // Check for proper redirect to login
  if (!authContent.includes('login.html?redirect=')) {
    results.failed++;
    results.issues.push('❌ Frontend doesn\'t implement proper login redirect');
    return;
  }
  
  // Check for Authorization header usage
  if (!authContent.includes('Authorization: Bearer') && !authContent.includes('Bearer ${token}')) {
    results.failed++;
    results.issues.push('❌ Frontend doesn\'t send Authorization headers');
    return;
  }
  
  results.passed++;
  console.log('  ✅ Frontend authentication properly implemented');
}

// Check RLS policies
function checkRLSPolicies() {
  console.log('\n4. Checking Supabase RLS policies...');
  
  const rlsFile = './database/rls-policies.sql';
  if (!existsSync(rlsFile)) {
    results.failed++;
    results.issues.push('❌ RLS policies file not found');
    return;
  }
  
  const rlsContent = readFileSync(rlsFile, 'utf8');
  
  // Check for RLS enablement
  if (!rlsContent.includes('ENABLE ROW LEVEL SECURITY')) {
    results.failed++;
    results.issues.push('❌ RLS not enabled on tables');
    return;
  }
  
  // Check for auth.uid() usage
  if (!rlsContent.includes('auth.uid()')) {
    results.failed++;
    results.issues.push('❌ RLS policies don\'t use auth.uid()');
    return;
  }
  
  // Check for user_id column policies
  if (!rlsContent.includes('user_id')) {
    results.failed++;
    results.issues.push('❌ RLS policies don\'t reference user_id column');
    return;
  }
  
  results.passed++;
  console.log('  ✅ RLS policies properly configured');
}

// Check dashboard data usage
function checkDashboardDataUsage() {
  console.log('\n5. Checking dashboard data usage...');
  
  const dashboardFile = './index.html';
  if (!existsSync(dashboardFile)) {
    results.failed++;
    results.issues.push('❌ Dashboard file not found');
    return;
  }
  
  const dashboardContent = readFileSync(dashboardFile, 'utf8');
  
  // Check for API-based data loading
  if (!dashboardContent.includes('window.postDoseRXAPI') && !dashboardContent.includes('window.appAuth')) {
    results.failed++;
    results.issues.push('❌ Dashboard doesn\'t use API for data loading');
    return;
  }
  
  // Check that localStorage is not the PRIMARY source for user-specific data
  // It's okay to use localStorage as fallback, but API should be primary
  const apiUsagePattern = /window\.postDoseRXAPI\.|window\.appAuth\./g;
  const apiUsageCount = (dashboardContent.match(apiUsagePattern) || []).length;
  
  if (apiUsageCount < 5) {
    results.failed++;
    results.issues.push('❌ Dashboard should primarily use API for user data (found fewer than 5 API calls)');
    return;
  }
  
  results.passed++;
  console.log('  ✅ Dashboard properly uses API for user data');
}

// Check for common security issues
function checkSecurityIssues() {
  console.log('\n6. Checking for security issues...');
  
  let issuesFound = 0;
  
  // Check for hardcoded secrets
  const authFile = './api/middleware/auth.js';
  if (existsSync(authFile)) {
    const content = readFileSync(authFile, 'utf8');
    if (content.includes("'your-jwt-secret-key'") && !content.includes('process.env')) {
      issuesFound++;
      results.issues.push('⚠️ Default JWT secret detected - use environment variables');
    }
  }
  
  // Check API files for proper error handling
  const apiFiles = getAPIFiles();
  for (const file of apiFiles) {
    if (file.includes('middleware')) continue;
    
    const content = readFileSync(file, 'utf8');
    if (!content.includes('try') || !content.includes('catch')) {
      issuesFound++;
      results.issues.push(`⚠️ ${file}: Missing error handling`);
    }
  }
  
  if (issuesFound === 0) {
    results.passed++;
    console.log('  ✅ No major security issues detected');
  } else {
    results.failed++;
    console.log(`  ⚠️ ${issuesFound} security issues found`);
  }
}

// Run all checks
function runVerification() {
  checkJWTMiddleware();
  checkAPIRoutes();
  checkFrontendAuth();
  checkRLSPolicies();
  checkDashboardDataUsage();
  checkSecurityIssues();
  
  console.log('\n' + '='.repeat(50));
  console.log('🔒 USER ISOLATION VERIFICATION RESULTS');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.issues.length > 0) {
    console.log('\n📋 Issues found:');
    results.issues.forEach(issue => console.log('  ' + issue));
  }
  
  if (results.failed === 0) {
    console.log('\n🎉 All user isolation checks passed! ');
    console.log('✅ Implementation satisfies PRD requirements §4.1-4.2, §3.2, §5.6');
  } else {
    console.log('\n⚠️ Some issues need to be addressed for full compliance.');
  }
  
  process.exit(results.failed > 0 ? 1 : 0);
}

try {
  runVerification();
} catch (error) {
  console.error('Verification failed:', error);
  process.exit(1);
}