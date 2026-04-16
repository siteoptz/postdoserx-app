# Agent Stack Rollback Procedures

## Emergency Rollback Steps

If the agent stack causes issues, follow these steps in order:

### 1. Disable CI Workflows (Immediate)
```bash
# Rename workflows to disable them
mv .github/workflows/agent-security.yml .github/workflows/agent-security.yml.disabled
mv .github/workflows/agent-quality.yml .github/workflows/agent-quality.yml.disabled
git add .github/workflows/
git commit -m "EMERGENCY: Disable agent stack CI workflows"
git push
```

### 2. Remove npm Scripts (If needed)
Edit `package.json` and remove all `agent:*` scripts:
- `agent:memory:check`
- `agent:plan`
- `agent:self-review` 
- `agent:review`
- `agent:review:ci`
- `agent:security`
- `agent:security:ci`
- `agent:ui-review`
- `agent:orchestrate`
- `agent:suppressions:parse`
- `agent:suppressions:parse:strict`
- `agent:suppressions:validate`

### 3. Remove Dependencies (If blocking development)
```bash
npm uninstall ajv ajv-formats
```

### 4. Full Removal (Nuclear option)
```bash
rm -rf docs/agent-stack/
rm -rf scripts/agent-*
rm -rf .claude/
git add .
git commit -m "ROLLBACK: Remove agent stack completely"
git push
```

## Partial Rollbacks

### Disable Security Scanning Only
Set `continue-on-error: true` in `.github/workflows/agent-security.yml`

### Disable Review Lanes Only  
Set `continue-on-error: true` in `.github/workflows/agent-quality.yml`

### Disable UI Review Only
Comment out UI review steps in workflows

## Recovery After Rollback

1. Investigate the root cause
2. Fix configuration issues
3. Test locally with `npm run agent:*` commands
4. Re-enable workflows gradually
5. Monitor for 24-48 hours before full re-deployment