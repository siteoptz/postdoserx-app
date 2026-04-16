#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const isCI = process.argv.includes('--ci');

const SECRET_PATTERNS = {
  'hardcoded-api-key': /['"](sk_live_|pk_live_|rk_live_)[a-zA-Z0-9]{20,}['"]/g,
  'supabase-service-key': /['"](eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*)['"]/g,
  'stripe-secret': /['"](sk_live_[a-zA-Z0-9]{20,})['"]/g,
  'generic-secret': /(password|secret|key|token)[\s]*[:=][\s]*['"'][^'"']{8,}['"']/gi,
  'hardcoded-url': /['"](https?:\/\/[^'"']*(?:password|token|key|secret)[^'"']*)['"]/gi
};

const DEPENDENCY_VULNS = {
  // Simulated vulnerability database
  '@supabase/supabase-js': {
    '^2.38.4': {
      severity: 'low',
      description: 'Potential XSS in browser client (example)',
      cve: 'CVE-2024-EXAMPLE'
    }
  }
};

async function scanSecrets() {
  const results = {
    type: 'secret-scan',
    issues: []
  };

  try {
    // Scan JavaScript files
    const { stdout } = await execAsync('find . -name "*.js" -not -path "./node_modules/*" -not -path "./scripts/*"');
    const jsFiles = stdout.split('\n').filter(Boolean);

    for (const file of jsFiles) {
      if (!fs.existsSync(file)) continue;
      
      const content = fs.readFileSync(file, 'utf8');
      
      for (const [ruleName, pattern] of Object.entries(SECRET_PATTERNS)) {
        const matches = content.match(pattern);
        if (matches) {
          for (const match of matches) {
            results.issues.push({
              type: 'secret',
              rule: ruleName,
              severity: 'high',
              message: `Potential secret detected: ${ruleName}`,
              file: file,
              line: content.split('\n').findIndex(line => line.includes(match)) + 1,
              evidence: match.substring(0, 50) + '...'
            });
          }
        }
      }
    }

    // Scan HTML files for embedded secrets
    const htmlFiles = ['index.html', 'login.html', 'after-checkout.html', 'success.html'];
    for (const file of htmlFiles) {
      if (!fs.existsSync(file)) continue;
      
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for inline script secrets
      const scriptMatches = content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      if (scriptMatches) {
        for (const script of scriptMatches) {
          for (const [ruleName, pattern] of Object.entries(SECRET_PATTERNS)) {
            const matches = script.match(pattern);
            if (matches) {
              results.issues.push({
                type: 'secret',
                rule: ruleName,
                severity: 'critical',
                message: `Secret in HTML script: ${ruleName}`,
                file: file,
                evidence: matches[0].substring(0, 30) + '...'
              });
            }
          }
        }
      }
    }

  } catch (error) {
    results.issues.push({
      type: 'error',
      severity: 'medium',
      message: `Secret scan error: ${error.message}`,
      file: 'unknown'
    });
  }

  return results;
}

async function scanDependencies() {
  const results = {
    type: 'dependency-scan',
    issues: []
  };

  try {
    if (!fs.existsSync('package.json')) {
      return results;
    }

    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const allDeps = { 
      ...packageJson.dependencies, 
      ...packageJson.devDependencies 
    };

    for (const [depName, version] of Object.entries(allDeps)) {
      if (DEPENDENCY_VULNS[depName]) {
        const vulnData = DEPENDENCY_VULNS[depName][version] || DEPENDENCY_VULNS[depName]['*'];
        if (vulnData) {
          results.issues.push({
            type: 'vulnerability',
            rule: 'known-vulnerability',
            severity: vulnData.severity,
            message: `Known vulnerability in ${depName}@${version}`,
            file: 'package.json',
            details: vulnData.description,
            cve: vulnData.cve
          });
        }
      }
    }

    // Try npm audit if available
    try {
      const { stdout } = await execAsync('npm audit --json', { timeout: 30000 });
      const auditResult = JSON.parse(stdout);
      
      if (auditResult.vulnerabilities) {
        for (const [pkg, vuln] of Object.entries(auditResult.vulnerabilities)) {
          if (vuln.severity && vuln.severity !== 'info') {
            results.issues.push({
              type: 'vulnerability',
              rule: 'npm-audit',
              severity: vuln.severity,
              message: `${vuln.severity} vulnerability in ${pkg}`,
              file: 'package.json',
              details: vuln.title,
              via: vuln.via
            });
          }
        }
      }
    } catch (auditError) {
      // npm audit failed or not available
      if (!auditError.message.includes('No issues found')) {
        results.issues.push({
          type: 'warning',
          severity: 'low',
          message: 'npm audit unavailable or failed',
          file: 'package.json'
        });
      }
    }

  } catch (error) {
    results.issues.push({
      type: 'error',
      severity: 'medium',
      message: `Dependency scan error: ${error.message}`,
      file: 'package.json'
    });
  }

  return results;
}

async function checkSuppressions(issues) {
  try {
    const suppressionPath = path.join(process.cwd(), 'docs/agent-stack/suppressions.json');
    if (!fs.existsSync(suppressionPath)) {
      return issues; // No suppressions
    }

    const suppressions = JSON.parse(fs.readFileSync(suppressionPath, 'utf8'));
    const activeSuppressions = suppressions.suppressions.filter(s => 
      s.type === 'security' && s.status === 'active' && new Date(s.expiry) > new Date()
    );

    return issues.filter(issue => {
      const suppressed = activeSuppressions.some(s => 
        s.rule_id === issue.rule && 
        (s.scope === issue.file || s.scope === 'global')
      );
      
      if (suppressed) {
        console.log(`Issue suppressed: ${issue.rule} in ${issue.file}`);
        return false;
      }
      return true;
    });
  } catch (error) {
    console.warn('Could not check suppressions:', error.message);
    return issues;
  }
}

async function generateSecurityReport(secretResults, depResults) {
  const allIssues = [...secretResults.issues, ...depResults.issues];
  const filteredIssues = await checkSuppressions(allIssues);
  
  const criticalIssues = filteredIssues.filter(i => i.severity === 'critical');
  const highIssues = filteredIssues.filter(i => i.severity === 'high');
  
  const report = {
    timestamp: new Date().toISOString(),
    total_issues: filteredIssues.length,
    critical_issues: criticalIssues.length,
    high_issues: highIssues.length,
    overall_status: criticalIssues.length > 0 ? 'critical' : 
                   highIssues.length > 0 ? 'high' : 
                   filteredIssues.length > 0 ? 'medium' : 'clean',
    scans: {
      secrets: secretResults,
      dependencies: depResults
    },
    summary: `Security scan: ${filteredIssues.length} issues (${criticalIssues.length} critical, ${highIssues.length} high)`
  };

  // Write report
  const reportPath = path.join(process.cwd(), 'docs/agent-stack/security-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Console output
  console.log('\n=== SECURITY SCAN SUMMARY ===');
  console.log(`Overall Status: ${report.overall_status.toUpperCase()}`);
  console.log(`Total Issues: ${filteredIssues.length}`);
  console.log(`Critical: ${criticalIssues.length}, High: ${highIssues.length}`);
  console.log('');

  if (filteredIssues.length > 0 && !isCI) {
    console.log('Issues found:');
    for (const issue of filteredIssues) {
      console.log(`  ${issue.severity}: ${issue.message} (${issue.file})`);
      if (issue.cve) console.log(`    CVE: ${issue.cve}`);
    }
  }

  if (isCI) {
    console.log(`Detailed report: ${reportPath}`);
    
    // Exit code based on enforcement policy
    // Stage 1: warn-only (exit 0)
    // TODO: Update to exit 1 for critical issues in later stages
    process.exit(0);
  }

  return report;
}

async function main() {
  try {
    console.log('Starting security scan...');
    
    const [secretResults, depResults] = await Promise.all([
      scanSecrets(),
      scanDependencies()
    ]);
    
    await generateSecurityReport(secretResults, depResults);
    
  } catch (error) {
    console.error('Security scan failed:', error.message);
    process.exit(1);
  }
}

main();