# Self-Review Template

**Feature/Task**: [Brief description]  
**Date**: [YYYY-MM-DD]  
**Reviewer**: [Name/Agent]

## Implementation Review

### Code Quality
- [ ] Code follows project conventions
- [ ] Functions are appropriately sized and focused
- [ ] Variable names are descriptive
- [ ] Comments explain why, not what
- [ ] No obvious code smells or anti-patterns

### Functionality
- [ ] All success criteria from plan are met
- [ ] Edge cases are handled appropriately
- [ ] Error handling is robust
- [ ] Input validation is present where needed

### Testing
- [ ] Adequate test coverage
- [ ] Tests are meaningful and test actual behavior
- [ ] Manual testing confirms expected behavior
- [ ] Performance is acceptable

### Security
- [ ] No hardcoded secrets or credentials
- [ ] Input sanitization where applicable
- [ ] Authentication/authorization properly implemented
- [ ] No obvious security vulnerabilities

### Documentation
- [ ] Code is self-documenting
- [ ] Complex logic is commented
- [ ] API changes are documented
- [ ] User-facing changes have appropriate documentation

## Issues Found
[List any issues discovered during self-review]

### Issue 1: [Description]
- **Severity**: High/Medium/Low
- **Status**: Fixed/Will fix in follow-up/Acceptable risk
- **Details**: [What was wrong and how it was addressed]

### Issue 2: [Description]
- **Severity**: High/Medium/Low
- **Status**: Fixed/Will fix in follow-up/Acceptable risk
- **Details**: [What was wrong and how it was addressed]

## Overall Assessment
- **Code Quality**: Excellent/Good/Needs Improvement
- **Readiness**: Ready to merge/Needs minor fixes/Needs major work
- **Confidence Level**: High/Medium/Low

## Next Steps
- [ ] Address any remaining issues
- [ ] Request external code review
- [ ] Update tests if needed
- [ ] Update documentation if needed