# Agent Stack

This directory contains the standardized multi-agent engineering workflow configuration for the PostDoseRX application.

## Overview

The agent stack provides:
- Plan → Tests/Checks → Implement → Self-Review discipline 
- Production UI quality presets
- Five parallel code review lanes with aggregated reporting
- Repository-wide vulnerability and secret scanning
- Cross-session project memory
- Multi-role orchestration without auto-deploy to production

## Structure

- `ENFORCEMENT_POLICY.md` - Rollout stages and enforcement matrix
- `BASELINE.md` - Current repository state baseline
- `CHANGELOG.md` - Agent stack changes and updates
- `ROLLBACK.md` - Emergency rollback procedures
- `templates/` - Plan and self-review templates
- `*-suppressions.md` - Suppression rules for various checks
- `suppression.schema.json` - JSON schema for suppression validation

## Commands

All agent commands are available via npm scripts:

```bash
npm run agent:memory:check
npm run agent:plan  
npm run agent:self-review
npm run agent:review
npm run agent:security
npm run agent:ui-review
npm run agent:orchestrate
```

See individual files for detailed documentation.