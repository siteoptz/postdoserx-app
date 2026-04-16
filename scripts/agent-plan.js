#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

function createPlan() {
  const planName = process.argv[2];
  
  if (!planName) {
    console.error('Usage: npm run agent:plan <plan-name>');
    console.log('Example: npm run agent:plan user-dashboard-improvements');
    process.exit(1);
  }

  const templatePath = path.join(process.cwd(), 'docs/agent-stack/templates/plan.md');
  
  if (!fs.existsSync(templatePath)) {
    console.error('ERROR: Plan template not found at', templatePath);
    process.exit(1);
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  const timestamp = new Date().toISOString().split('T')[0];
  
  // Replace template placeholders
  const planContent = template
    .replace('[Brief description]', planName.replace(/-/g, ' '))
    .replace('[YYYY-MM-DD]', timestamp)
    .replace('[Name/Agent]', 'Claude Agent');

  // Create plans directory if it doesn't exist
  const plansDir = path.join(process.cwd(), 'docs/agent-stack/plans');
  if (!fs.existsSync(plansDir)) {
    fs.mkdirSync(plansDir, { recursive: true });
  }

  const planPath = path.join(plansDir, `${planName}-${timestamp}.md`);
  
  if (fs.existsSync(planPath)) {
    console.error('ERROR: Plan file already exists:', planPath);
    process.exit(1);
  }

  fs.writeFileSync(planPath, planContent);
  
  console.log('✓ Plan created:', planPath);
  console.log('');
  console.log('Next steps:');
  console.log('1. Edit the plan file to define your implementation');
  console.log('2. Run implementation with proper testing');
  console.log('3. Create self-review with: npm run agent:self-review');
  console.log('4. Submit for code review when ready');

  // Check for protected paths that might require extra scrutiny
  const protectedPaths = ['/api/', '/login.html', '/after-checkout.html', '/success.html'];
  console.log('');
  console.log('NOTE: If your changes affect protected paths, ensure:');
  for (const path of protectedPaths) {
    console.log(`  - ${path}: Security and functionality review required`);
  }
}

createPlan();