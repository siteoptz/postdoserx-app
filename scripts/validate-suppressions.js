#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const DOCS_DIR = path.join(process.cwd(), 'docs/agent-stack');

function validateSuppressions() {
  try {
    const schemaPath = path.join(DOCS_DIR, 'suppression.schema.json');
    const dataPath = path.join(DOCS_DIR, 'suppressions.json');
    
    if (!fs.existsSync(schemaPath)) {
      console.error('Schema file not found:', schemaPath);
      process.exit(1);
    }
    
    if (!fs.existsSync(dataPath)) {
      console.error('Suppressions JSON not found. Run npm run agent:suppressions:parse first');
      process.exit(1);
    }
    
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    
    let errors = 0;
    const now = new Date();
    
    for (const suppression of data.suppressions) {
      // Validate against schema
      const validate = ajv.compile(schema);
      const valid = validate(suppression);
      
      if (!valid) {
        console.error(`\nValidation errors for ${suppression.id}:`);
        for (const error of validate.errors) {
          console.error(`  ${error.instancePath || 'root'}: ${error.message}`);
        }
        errors++;
      }
      
      // Check expiry dates
      if (suppression.expiry) {
        const expiryDate = new Date(suppression.expiry);
        if (expiryDate < now) {
          console.warn(`\nWARNING: ${suppression.id} has expired (${suppression.expiry})`);
        }
        
        // Check expiry limits based on severity
        const introDate = new Date(suppression.introduced_on);
        const daysDiff = (expiryDate - introDate) / (1000 * 60 * 60 * 24);
        
        let maxDays;
        switch (suppression.severity) {
          case 'critical':
            maxDays = 90;
            break;
          case 'high':
            maxDays = 90;
            break;
          case 'medium':
            maxDays = 180;
            break;
          case 'low':
            maxDays = 180;
            break;
        }
        
        if (daysDiff > maxDays) {
          console.error(`\nERROR: ${suppression.id} expiry exceeds maximum ${maxDays} days for ${suppression.severity} severity`);
          errors++;
        }
      }
      
      // Check review date freshness
      if (suppression.last_reviewed) {
        const reviewDate = new Date(suppression.last_reviewed);
        const daysSinceReview = (now - reviewDate) / (1000 * 60 * 60 * 24);
        
        let maxReviewDays;
        switch (suppression.type) {
          case 'security':
            maxReviewDays = 7; // weekly
            break;
          case 'review':  
            maxReviewDays = 14; // bi-weekly
            break;
          case 'ui':
            maxReviewDays = 7; // weekly
            break;
        }
        
        if (daysSinceReview > maxReviewDays) {
          console.warn(`\nWARNING: ${suppression.id} review is overdue (last: ${suppression.last_reviewed})`);
        }
      }
    }
    
    if (errors > 0) {
      console.error(`\nValidation failed with ${errors} errors`);
      process.exit(1);
    } else {
      console.log(`\nValidation passed for ${data.suppressions.length} suppressions`);
    }
    
  } catch (error) {
    console.error('Validation error:', error.message);
    process.exit(1);
  }
}

validateSuppressions();