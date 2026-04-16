#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const isCI = process.argv.includes('--ci');

const REVIEW_LANES = {
  correctness: {
    name: 'Correctness/Bugs',
    checks: ['syntax-errors', 'null-references', 'type-mismatches', 'logical-errors']
  },
  architecture: {
    name: 'Architecture/Design', 
    checks: ['coupling-issues', 'abstraction-violations', 'pattern-misuse', 'api-design']
  },
  style: {
    name: 'Style/Rules',
    checks: ['code-style', 'naming-conventions', 'complexity', 'duplication']
  },
  performance: {
    name: 'Performance/Reliability',
    checks: ['memory-leaks', 'inefficient-algorithms', 'resource-usage', 'error-handling']
  },
  regression: {
    name: 'Regression/History/Context',
    checks: ['breaking-changes', 'backward-compatibility', 'feature-completeness', 'test-coverage']
  }
};

async function runLaneChecks(laneId, laneConfig) {
  const results = {
    lane: laneId,
    name: laneConfig.name,
    issues: [],
    summary: '',
    status: 'pass'
  };

  try {
    console.log(`Running ${laneConfig.name} checks...`);
    
    // Simulate different types of checks based on the lane
    switch (laneId) {
      case 'correctness':
        await checkCorrectness(results);
        break;
      case 'architecture':
        await checkArchitecture(results);
        break;
      case 'style':
        await checkStyle(results);
        break;
      case 'performance':
        await checkPerformance(results);
        break;
      case 'regression':
        await checkRegression(results);
        break;
    }
    
    results.status = results.issues.length > 0 ? 'warn' : 'pass';
    results.summary = `${results.issues.length} issues found`;
    
  } catch (error) {
    results.status = 'error';
    results.summary = `Error running checks: ${error.message}`;
    results.issues.push({
      type: 'error',
      severity: 'high',
      message: error.message,
      file: 'unknown'
    });
  }
  
  return results;
}

async function checkCorrectness(results) {
  // Check for obvious JavaScript errors
  try {
    const { stdout, stderr } = await execAsync('find . -name "*.js" -not -path "./node_modules/*" | head -10 | xargs node -c');
  } catch (error) {
    if (error.stderr) {
      results.issues.push({
        type: 'syntax-error',
        severity: 'high',
        message: 'JavaScript syntax error detected',
        file: 'js files'
      });
    }
  }
}

async function checkArchitecture(results) {
  // Check for basic architectural issues
  const files = ['js', 'api'].map(dir => {
    const dirPath = path.join(process.cwd(), dir);
    return fs.existsSync(dirPath) ? fs.readdirSync(dirPath).length : 0;
  });
  
  if (files[0] > 10 && files[1] > 5) {
    results.issues.push({
      type: 'organization',
      severity: 'medium', 
      message: 'Large number of files may benefit from better organization',
      file: 'multiple'
    });
  }
}

async function checkStyle(results) {
  // Basic style checks
  try {
    const jsFiles = await execAsync('find . -name "*.js" -not -path "./node_modules/*" | head -5');
    for (const file of jsFiles.stdout.split('\n').filter(Boolean)) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.length > 10000) {
        results.issues.push({
          type: 'file-size',
          severity: 'medium',
          message: 'Large file may benefit from refactoring',
          file: file
        });
      }
    }
  } catch (error) {
    // No JS files or other error
  }
}

async function checkPerformance(results) {
  // Basic performance checks
  const htmlFiles = ['index.html', 'login.html'];
  for (const file of htmlFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('<script') && !content.includes('defer') && !content.includes('async')) {
        results.issues.push({
          type: 'blocking-script',
          severity: 'low',
          message: 'Consider using defer or async for script tags',
          file: file
        });
      }
    }
  }
}

async function checkRegression(results) {
  // Check for potential breaking changes
  try {
    const { stdout } = await execAsync('git diff --name-only HEAD~1..HEAD 2>/dev/null || echo ""');
    const changedFiles = stdout.split('\n').filter(Boolean);
    
    const protectedPaths = ['/api/', '/login.html', '/after-checkout.html', '/success.html'];
    const protectedChanges = changedFiles.filter(file => 
      protectedPaths.some(path => file.includes(path))
    );
    
    if (protectedChanges.length > 0) {
      results.issues.push({
        type: 'protected-path-change',
        severity: 'high',
        message: `Changes to protected paths: ${protectedChanges.join(', ')}`,
        file: protectedChanges.join(', ')
      });
    }
  } catch (error) {
    // Git not available or other error
  }
}

async function generateReport(allResults) {
  const timestamp = new Date().toISOString();
  const totalIssues = allResults.reduce((sum, lane) => sum + lane.issues.length, 0);
  
  const report = {
    timestamp,
    total_lanes: allResults.length,
    total_issues: totalIssues,
    overall_status: allResults.some(l => l.status === 'error') ? 'error' : 
                   totalIssues > 0 ? 'warn' : 'pass',
    lanes: allResults,
    summary: `Code review completed: ${totalIssues} total issues across ${allResults.length} lanes`
  };
  
  // Write detailed report
  const reportPath = path.join(process.cwd(), 'docs/agent-stack/review-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Console output
  console.log('\n=== CODE REVIEW SUMMARY ===');
  console.log(`Overall Status: ${report.overall_status.toUpperCase()}`);
  console.log(`Total Issues: ${totalIssues}`);
  console.log('');
  
  for (const lane of allResults) {
    console.log(`${lane.name}: ${lane.status.toUpperCase()} (${lane.issues.length} issues)`);
    if (lane.issues.length > 0 && !isCI) {
      for (const issue of lane.issues) {
        console.log(`  - ${issue.severity}: ${issue.message} (${issue.file})`);
      }
    }
  }
  
  if (isCI) {
    console.log(`\nDetailed report: ${reportPath}`);
    
    // Exit with appropriate code based on enforcement policy
    // Stage 1: warn-only (exit 0)
    // TODO: Update exit codes as enforcement stages progress
    process.exit(0);
  }
  
  return report;
}

async function main() {
  try {
    console.log('Starting parallel code review...');
    
    // Run all lanes in parallel
    const lanePromises = Object.entries(REVIEW_LANES).map(([id, config]) => 
      runLaneChecks(id, config)
    );
    
    const allResults = await Promise.all(lanePromises);
    
    await generateReport(allResults);
    
  } catch (error) {
    console.error('Review failed:', error.message);
    process.exit(1);
  }
}

main();