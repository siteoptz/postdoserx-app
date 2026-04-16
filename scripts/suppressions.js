#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const DOCS_DIR = path.join(process.cwd(), 'docs/agent-stack');
const SUPPRESSION_FILES = ['security-suppressions.md', 'review-suppressions.md', 'ui-suppressions.md'];

function parseSuppressionFile(filename) {
  const filepath = path.join(DOCS_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf8');
  
  const suppressions = [];
  const sections = content.split(/^## (SEC|REV|UI)-(\d+)$/gm);
  
  for (let i = 1; i < sections.length; i += 3) {
    const type = sections[i].toLowerCase();
    const number = sections[i + 1];
    const sectionContent = sections[i + 2];
    
    if (!sectionContent) continue;
    
    const suppression = {
      id: `${sections[i]}-${number}`,
      type: type === 'sec' ? 'security' : type === 'rev' ? 'review' : 'ui'
    };
    
    // Parse bullet points
    const lines = sectionContent.split('\n').filter(line => line.trim().startsWith('- **'));
    
    for (const line of lines) {
      const match = line.match(/- \*\*([^*]+)\*\*:\s*(.+)/);
      if (match) {
        const key = match[1].toLowerCase().replace(/[^a-z]/g, '_');
        const value = match[2].trim();
        
        switch (key) {
          case 'status':
            suppression.status = value;
            break;
          case 'severity':
            suppression.severity = value;
            break;
          case 'rule':
            suppression.rule_id = value;
            break;
          case 'file':
          case 'files':
          case 'function':
          case 'element':
          case 'package':
            suppression.scope = value;
            break;
          case 'expiry':
            suppression.expiry = value;
            break;
          case 'owner':
            suppression.owner = value;
            break;
          case 'rationale':
            suppression.rationale = value;
            break;
          case 'issue':
            suppression.issue_link = value;
            break;
          case 'last_reviewed':
            suppression.last_reviewed = value;
            break;
          case 'tool':
            suppression.tool = value;
            break;
          case 'lane':
            suppression.lane = value;
            break;
          case 'category':
            suppression.category = value;
            break;
          case 'impacted_flows':
            suppression.impacted_flows = value;
            break;
          case 'approver':
            suppression.approver = value;
            break;
        }
      }
    }
    
    // Set defaults and validate required fields
    suppression.introduced_on = suppression.introduced_on || suppression.last_reviewed || new Date().toISOString().split('T')[0];
    
    const strict = process.argv.includes('--strict=true');
    
    if (strict) {
      const required = ['status', 'severity', 'rule_id', 'scope', 'expiry', 'owner', 'rationale', 'issue_link', 'last_reviewed'];
      const missing = required.filter(field => !suppression[field]);
      
      if (missing.length > 0) {
        console.error(`ERROR: Missing required fields in ${suppression.id}: ${missing.join(', ')}`);
        process.exit(1);
      }
    }
    
    suppressions.push(suppression);
  }
  
  return suppressions;
}

function main() {
  try {
    const allSuppressions = [];
    
    for (const file of SUPPRESSION_FILES) {
      const filepath = path.join(DOCS_DIR, file);
      if (fs.existsSync(filepath)) {
        const suppressions = parseSuppressionFile(file);
        allSuppressions.push(...suppressions);
      }
    }
    
    const output = {
      generated_at: new Date().toISOString(),
      total_suppressions: allSuppressions.length,
      suppressions: allSuppressions
    };
    
    const outputPath = path.join(DOCS_DIR, 'suppressions.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`Parsed ${allSuppressions.length} suppressions to ${outputPath}`);
    
  } catch (error) {
    console.error('Error parsing suppressions:', error.message);
    process.exit(1);
  }
}

main();