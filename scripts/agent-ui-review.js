#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const UI_CHECKS = {
  accessibility: {
    'missing-alt-text': /(<img(?![^>]*alt=)[^>]*>)/gi,
    'missing-labels': /(<input(?![^>]*aria-label)(?![^>]*<label[^>]*for=)[^>]*>)/gi,
    'low-contrast': /(color:\s*#[a-f0-9]{6}.*background-color:\s*#[a-f0-9]{6})/gi,
    'missing-headings': /<h[1-6][^>]*>\s*<\/h[1-6]>/gi,
    'missing-lang': /<html(?![^>]*lang=)[^>]*>/gi
  },
  usability: {
    'small-touch-targets': /(<button[^>]*style="[^"]*(?:width|height):\s*(?:[0-9]|[1-3][0-9])px)/gi,
    'missing-focus': /(<button[^>]*style="[^"]*outline:\s*none)/gi,
    'form-no-validation': /(<form(?![^>]*novalidate)[^>]*>)/gi
  },
  design: {
    'inline-styles': /style\s*=\s*["'][^"']*["']/gi,
    'deprecated-tags': /<(font|center|big|small|tt)[^>]*>/gi,
    'missing-viewport': /<meta(?![^>]*viewport)[^>]*>/gi
  },
  performance: {
    'blocking-scripts': /<script(?![^>]*(?:async|defer))[^>]*src=/gi,
    'unoptimized-images': /<img(?![^>]*(?:loading="lazy"|width|height))[^>]*>/gi,
    'external-resources': /<(?:link|script)[^>]*(?:href|src)="(?!\/|#)[^"]*"/gi
  }
};

async function scanHtmlFile(filePath) {
  const results = {
    file: filePath,
    issues: []
  };

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    for (const [category, checks] of Object.entries(UI_CHECKS)) {
      for (const [ruleName, pattern] of Object.entries(checks)) {
        const matches = content.match(pattern);
        if (matches) {
          for (const match of matches) {
            const lineNumber = content.substring(0, content.indexOf(match)).split('\n').length;
            
            let severity = 'medium';
            if (category === 'accessibility' && ['missing-alt-text', 'missing-labels', 'missing-lang'].includes(ruleName)) {
              severity = 'high';
            }
            if (category === 'usability' && ruleName === 'small-touch-targets') {
              severity = 'high';
            }
            if (category === 'performance' && ruleName === 'blocking-scripts') {
              severity = 'low';
            }
            
            results.issues.push({
              type: category,
              rule: ruleName,
              severity: severity,
              message: getIssueMessage(ruleName),
              line: lineNumber,
              element: match.substring(0, 100) + (match.length > 100 ? '...' : '')
            });
          }
        }
      }
    }
    
  } catch (error) {
    results.issues.push({
      type: 'error',
      severity: 'medium',
      message: `Error scanning file: ${error.message}`,
      file: filePath
    });
  }

  return results;
}

function getIssueMessage(ruleName) {
  const messages = {
    'missing-alt-text': 'Image missing alt attribute for screen readers',
    'missing-labels': 'Form input missing accessible label',
    'low-contrast': 'Potential low color contrast issue',
    'missing-headings': 'Empty heading element',
    'missing-lang': 'HTML element missing lang attribute',
    'small-touch-targets': 'Touch target may be too small (<44px)',
    'missing-focus': 'Focus outline removed without replacement',
    'form-no-validation': 'Form missing client-side validation',
    'inline-styles': 'Inline styles reduce maintainability',
    'deprecated-tags': 'Deprecated HTML element used',
    'missing-viewport': 'Missing viewport meta tag for mobile',
    'blocking-scripts': 'Script tag may block page rendering',
    'unoptimized-images': 'Image missing optimization attributes',
    'external-resources': 'External resource may affect performance'
  };
  
  return messages[ruleName] || `Issue detected: ${ruleName}`;
}

async function checkSuppressions(issues) {
  try {
    const suppressionPath = path.join(process.cwd(), 'docs/agent-stack/suppressions.json');
    if (!fs.existsSync(suppressionPath)) {
      return issues;
    }

    const suppressions = JSON.parse(fs.readFileSync(suppressionPath, 'utf8'));
    const activeSuppressions = suppressions.suppressions.filter(s => 
      s.type === 'ui' && s.status === 'active' && new Date(s.expiry) > new Date()
    );

    return issues.filter(issue => {
      const suppressed = activeSuppressions.some(s => 
        s.rule_id === issue.rule && 
        (s.scope === issue.file || s.scope.includes(issue.file))
      );
      
      if (suppressed) {
        console.log(`UI issue suppressed: ${issue.rule} in ${issue.file}`);
        return false;
      }
      return true;
    });
  } catch (error) {
    console.warn('Could not check UI suppressions:', error.message);
    return issues;
  }
}

async function generateUIReport(fileResults) {
  const allIssues = fileResults.flatMap(result => 
    result.issues.map(issue => ({ ...issue, file: result.file }))
  );
  
  const filteredIssues = await checkSuppressions(allIssues);
  
  const accessibilityIssues = filteredIssues.filter(i => i.type === 'accessibility');
  const highIssues = filteredIssues.filter(i => i.severity === 'high');
  
  const report = {
    timestamp: new Date().toISOString(),
    files_scanned: fileResults.length,
    total_issues: filteredIssues.length,
    accessibility_issues: accessibilityIssues.length,
    high_severity: highIssues.length,
    overall_status: highIssues.length > 0 ? 'high' : 
                   filteredIssues.length > 0 ? 'medium' : 'clean',
    by_category: {
      accessibility: filteredIssues.filter(i => i.type === 'accessibility').length,
      usability: filteredIssues.filter(i => i.type === 'usability').length,
      design: filteredIssues.filter(i => i.type === 'design').length,
      performance: filteredIssues.filter(i => i.type === 'performance').length
    },
    files: fileResults,
    summary: `UI review: ${filteredIssues.length} issues across ${fileResults.length} files`
  };

  // Write report
  const reportPath = path.join(process.cwd(), 'docs/agent-stack/ui-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Console output
  console.log('\n=== UI REVIEW SUMMARY ===');
  console.log(`Overall Status: ${report.overall_status.toUpperCase()}`);
  console.log(`Files Scanned: ${report.files_scanned}`);
  console.log(`Total Issues: ${filteredIssues.length}`);
  console.log(`Accessibility Issues: ${accessibilityIssues.length}`);
  console.log('');

  console.log('Issues by Category:');
  for (const [category, count] of Object.entries(report.by_category)) {
    if (count > 0) {
      console.log(`  ${category}: ${count}`);
    }
  }

  if (filteredIssues.length > 0) {
    console.log('\nTop Issues:');
    const topIssues = filteredIssues
      .filter(i => i.severity === 'high')
      .slice(0, 5);
    
    for (const issue of topIssues) {
      console.log(`  ${issue.severity}: ${issue.message} (${issue.file}:${issue.line})`);
    }
  }

  console.log(`\nDetailed report: ${reportPath}`);
  
  // Exit code based on enforcement policy  
  // Stage 1: warn-only (exit 0)
  process.exit(0);

  return report;
}

async function main() {
  try {
    console.log('Starting UI review...');
    
    // Find HTML files to scan
    const htmlFiles = [
      'index.html',
      'login.html', 
      'after-checkout.html',
      'success.html'
    ].filter(file => fs.existsSync(file));

    if (htmlFiles.length === 0) {
      console.log('No HTML files found to review');
      return;
    }

    console.log(`Scanning ${htmlFiles.length} HTML files...`);
    
    // Scan all files
    const fileResults = await Promise.all(
      htmlFiles.map(file => scanHtmlFile(file))
    );
    
    await generateUIReport(fileResults);
    
  } catch (error) {
    console.error('UI review failed:', error.message);
    process.exit(1);
  }
}

main();