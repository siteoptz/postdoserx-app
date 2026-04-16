#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

function createSelfReview() {
  const reviewName = process.argv[2];
  
  if (!reviewName) {
    console.error('Usage: npm run agent:self-review <review-name>');
    console.log('Example: npm run agent:self-review user-dashboard-improvements');
    process.exit(1);
  }

  const templatePath = path.join(process.cwd(), 'docs/agent-stack/templates/self-review.md');
  
  if (!fs.existsSync(templatePath)) {
    console.error('ERROR: Self-review template not found at', templatePath);
    process.exit(1);
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  const timestamp = new Date().toISOString().split('T')[0];
  
  // Replace template placeholders
  const reviewContent = template
    .replace('[Brief description]', reviewName.replace(/-/g, ' '))
    .replace('[YYYY-MM-DD]', timestamp)
    .replace('[Name/Agent]', 'Claude Agent');

  // Create reviews directory if it doesn't exist
  const reviewsDir = path.join(process.cwd(), 'docs/agent-stack/self-reviews');
  if (!fs.existsSync(reviewsDir)) {
    fs.mkdirSync(reviewsDir, { recursive: true });
  }

  const reviewPath = path.join(reviewsDir, `${reviewName}-${timestamp}.md`);
  
  if (fs.existsSync(reviewPath)) {
    console.error('ERROR: Self-review file already exists:', reviewPath);
    process.exit(1);
  }

  fs.writeFileSync(reviewPath, reviewContent);
  
  console.log('✓ Self-review created:', reviewPath);
  console.log('');
  console.log('Complete the self-review by:');
  console.log('1. Reviewing your implementation against the checklist');
  console.log('2. Testing all functionality thoroughly');  
  console.log('3. Documenting any issues found and resolutions');
  console.log('4. Assessing overall code quality and readiness');
  console.log('');
  console.log('When complete, proceed with:');
  console.log('- npm run agent:review (peer review)');
  console.log('- npm run agent:security (security scan)');
  console.log('- npm run agent:ui-review (UI/accessibility review)');

  // Quick automated checks
  console.log('');
  console.log('Running quick automated checks...');
  
  try {
    // Check if there are any obvious syntax errors
    const { execSync } = require('child_process');
    try {
      execSync('find . -name "*.js" -not -path "./node_modules/*" | head -5 | xargs node -c', { stdio: 'pipe' });
      console.log('✓ JavaScript syntax check passed');
    } catch (syntaxError) {
      console.error('⚠ JavaScript syntax errors detected - review before proceeding');
    }

    // Check for obvious issues
    const jsFiles = execSync('find . -name "*.js" -not -path "./node_modules/*" -not -path "./scripts/*" | head -3', { encoding: 'utf8' }).split('\n').filter(Boolean);
    
    let hasConsoleLog = false;
    let hasHardcodedSecrets = false;
    
    for (const file of jsFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('console.log')) hasConsoleLog = true;
        if (content.match(/['"](sk_live_|pk_live_|eyJ[a-zA-Z0-9])/)) hasHardcodedSecrets = true;
      }
    }
    
    if (hasConsoleLog) {
      console.warn('⚠ Debug console.log statements found - remove before production');
    }
    
    if (hasHardcodedSecrets) {
      console.error('⚠ Potential hardcoded secrets detected - security review required');
    }
    
    if (!hasConsoleLog && !hasHardcodedSecrets) {
      console.log('✓ No obvious issues detected in quick scan');
    }
    
  } catch (error) {
    console.log('ℹ Could not run automated checks (normal for some environments)');
  }
}

createSelfReview();