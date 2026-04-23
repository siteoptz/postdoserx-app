#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

async function checkMemoryBootstrap() {
  const memoryPath = path.join(process.cwd(), 'docs/agent-stack/memory-bootstrap.md');
  
  if (!fs.existsSync(memoryPath)) {
    console.error('ERROR: Memory bootstrap file not found');
    console.log('Expected location:', memoryPath);
    process.exit(1);
  }

  const content = fs.readFileSync(memoryPath, 'utf8');
  const requiredSections = [
    'Project Overview',
    'Architecture', 
    'Key Files & Patterns',
    'Development Workflow',
    'Agent Stack Status'
  ];

  const missingSections = requiredSections.filter(section => 
    !content.includes(`## ${section}`)
  );

  if (missingSections.length > 0) {
    console.error('ERROR: Missing memory sections:', missingSections.join(', '));
    process.exit(1);
  }

  console.log('✓ Memory bootstrap file present and complete');

  // Required "contract" snippets so auth/redirect rules cannot be accidentally deleted from memory
  const requiredSnippets = [
    { label: 'Marketing login URL', needle: 'postdoserx.com/login.html' },
    { label: 'Stripe-only api/login warning', needle: 'api/login.js' },
    { label: 'Memory anchor', needle: 'MEMORY_ANCHOR_REDIRECTS' },
    { label: 'GHL / requiresSignup', needle: 'requiresSignup' },
  ];
  for (const { label, needle } of requiredSnippets) {
    if (!content.includes(needle)) {
      console.error(`ERROR: Memory bootstrap missing required text (${label}): "${needle}"`);
      process.exit(1);
    }
  }
  console.log('✓ Auth/redirect contract snippets present in memory-bootstrap.md');
  
  // Check if memory is fresh (updated recently)
  const stats = fs.statSync(memoryPath);
  const daysSinceUpdate = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSinceUpdate > 30) {
    console.warn(`WARNING: Memory bootstrap is ${Math.round(daysSinceUpdate)} days old`);
    console.log('Consider updating with recent project changes');
  } else {
    console.log(`✓ Memory bootstrap is fresh (${Math.round(daysSinceUpdate)} days old)`);
  }

  // Validate baseline exists
  const baselinePath = path.join(process.cwd(), 'docs/agent-stack/BASELINE.md');
  if (!fs.existsSync(baselinePath)) {
    console.warn('WARNING: BASELINE.md not found - memory may lack context');
  } else {
    console.log('✓ Baseline documentation present');
  }

  console.log('\nMemory check complete');
}

checkMemoryBootstrap();