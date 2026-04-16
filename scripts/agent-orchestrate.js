#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const ROLES = {
  ceo: {
    name: 'CEO/Product Owner',
    responsibilities: ['strategic-direction', 'user-impact', 'business-value'],
    concerns: ['user-experience', 'revenue-impact', 'competitive-advantage']
  },
  em: {
    name: 'Engineering Manager',
    responsibilities: ['technical-feasibility', 'resource-planning', 'risk-assessment'],
    concerns: ['delivery-timeline', 'technical-debt', 'team-capacity']
  },
  qa: {
    name: 'Quality Assurance',
    responsibilities: ['test-coverage', 'edge-cases', 'user-acceptance'],
    concerns: ['regression-risk', 'performance-impact', 'data-integrity']
  },
  security: {
    name: 'Security Lead',
    responsibilities: ['vulnerability-assessment', 'compliance', 'data-protection'],
    concerns: ['attack-vectors', 'sensitive-data', 'authentication-flows']
  },
  release: {
    name: 'Release Manager',
    responsibilities: ['deployment-readiness', 'rollback-planning', 'monitoring'],
    concerns: ['production-stability', 'feature-flags', 'rollout-strategy']
  }
};

async function gatherContext() {
  const context = {
    recent_changes: [],
    current_branch: 'unknown',
    protected_files_changed: false,
    test_results: 'unknown',
    security_status: 'unknown'
  };

  try {
    // Get current branch
    const { stdout: branch } = await execAsync('git branch --show-current 2>/dev/null || echo "unknown"');
    context.current_branch = branch.trim();

    // Get recent changes
    const { stdout: changes } = await execAsync('git diff --name-only HEAD~3..HEAD 2>/dev/null || echo ""');
    context.recent_changes = changes.split('\n').filter(Boolean);

    // Check for protected path changes
    const protectedPaths = ['/api/', '/login.html', '/after-checkout.html', '/success.html'];
    context.protected_files_changed = context.recent_changes.some(file =>
      protectedPaths.some(path => file.includes(path))
    );

    // Check latest security report
    const securityReportPath = path.join(process.cwd(), 'docs/agent-stack/security-report.json');
    if (fs.existsSync(securityReportPath)) {
      const report = JSON.parse(fs.readFileSync(securityReportPath, 'utf8'));
      context.security_status = report.overall_status;
    }

    // Check latest review report  
    const reviewReportPath = path.join(process.cwd(), 'docs/agent-stack/review-report.json');
    if (fs.existsSync(reviewReportPath)) {
      const report = JSON.parse(fs.readFileSync(reviewReportPath, 'utf8'));
      context.review_status = report.overall_status;
    }

  } catch (error) {
    console.warn('Could not gather full context:', error.message);
  }

  return context;
}

function generateRoleInput(roleId, roleConfig, context) {
  const concerns = [];
  
  switch (roleId) {
    case 'ceo':
      if (context.protected_files_changed) {
        concerns.push('Critical user flow changes detected - user impact assessment needed');
      }
      concerns.push('Business value and user experience implications');
      break;
      
    case 'em':
      if (context.recent_changes.length > 10) {
        concerns.push('Large changeset - consider breaking into smaller releases');
      }
      concerns.push('Technical feasibility and resource requirements');
      break;
      
    case 'qa':
      if (context.protected_files_changed) {
        concerns.push('Protected path changes require comprehensive testing');
      }
      concerns.push('Test coverage and regression risk assessment');
      break;
      
    case 'security':
      if (context.security_status !== 'clean') {
        concerns.push(`Security scan status: ${context.security_status} - review required`);
      }
      if (context.protected_files_changed) {
        concerns.push('Security-critical files changed - thorough audit needed');
      }
      break;
      
    case 'release':
      if (context.current_branch === 'main') {
        concerns.push('Main branch deployment - production readiness check required');
      }
      concerns.push('Deployment strategy and rollback planning');
      break;
  }

  return {
    role: roleConfig.name,
    responsibilities: roleConfig.responsibilities,
    specific_concerns: concerns,
    context_awareness: {
      files_changed: context.recent_changes.length,
      protected_paths_affected: context.protected_files_changed,
      security_status: context.security_status,
      branch: context.current_branch
    }
  };
}

async function generateOrchestrationReport(context, roleInputs) {
  const report = {
    timestamp: new Date().toISOString(),
    context: context,
    roles: roleInputs,
    recommendations: [],
    blocking_issues: [],
    production_readiness: 'pending',
    summary: ''
  };

  // Analyze cross-role concerns
  const allConcerns = roleInputs.flatMap(role => role.specific_concerns);
  
  // Identify blocking issues
  if (context.security_status === 'critical') {
    report.blocking_issues.push('Critical security issues must be resolved before production');
  }
  
  if (context.protected_files_changed && !fs.existsSync('docs/agent-stack/plans')) {
    report.blocking_issues.push('Protected path changes require formal planning documentation');
  }

  // Generate recommendations
  if (context.recent_changes.length > 5) {
    report.recommendations.push('Consider feature flags for gradual rollout');
  }
  
  if (context.protected_files_changed) {
    report.recommendations.push('Require manual approval from security and QA leads');
    report.recommendations.push('Plan staged deployment with monitoring');
  }

  // Determine production readiness
  if (report.blocking_issues.length === 0) {
    if (context.security_status === 'clean' && context.review_status !== 'error') {
      report.production_readiness = 'ready';
    } else {
      report.production_readiness = 'conditional';
    }
  } else {
    report.production_readiness = 'blocked';
  }

  report.summary = `Orchestration analysis: ${report.production_readiness} for production (${report.blocking_issues.length} blocking issues, ${report.recommendations.length} recommendations)`;

  return report;
}

async function main() {
  try {
    console.log('Starting gStack orchestration...');
    
    const context = await gatherContext();
    console.log(`Context: ${context.recent_changes.length} recent changes, branch: ${context.current_branch}`);
    
    // Generate role-specific inputs
    const roleInputs = Object.entries(ROLES).map(([roleId, roleConfig]) =>
      generateRoleInput(roleId, roleConfig, context)
    );
    
    // Generate orchestration report
    const report = await generateOrchestrationReport(context, roleInputs);
    
    // Write report
    const reportPath = path.join(process.cwd(), 'docs/agent-stack/orchestration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Console output
    console.log('\n=== GSTACK ORCHESTRATION SUMMARY ===');
    console.log(`Production Readiness: ${report.production_readiness.toUpperCase()}`);
    console.log(`Blocking Issues: ${report.blocking_issues.length}`);
    console.log(`Recommendations: ${report.recommendations.length}`);
    console.log('');
    
    if (report.blocking_issues.length > 0) {
      console.log('🚫 BLOCKING ISSUES:');
      report.blocking_issues.forEach(issue => console.log(`  - ${issue}`));
      console.log('');
    }
    
    if (report.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS:');
      report.recommendations.forEach(rec => console.log(`  - ${rec}`));
      console.log('');
    }
    
    console.log('Role Perspectives:');
    roleInputs.forEach(role => {
      console.log(`  ${role.role}: ${role.specific_concerns.length} concerns`);
    });
    
    console.log(`\nDetailed report: ${reportPath}`);
    
    // Exit code based on production readiness
    if (report.production_readiness === 'blocked') {
      console.log('\n❌ Production deployment BLOCKED');
      process.exit(1);
    } else if (report.production_readiness === 'conditional') {
      console.log('\n⚠️  Production deployment requires manual approval');
      process.exit(0);
    } else {
      console.log('\n✅ Production deployment approved');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('Orchestration failed:', error.message);
    process.exit(1);
  }
}

main();