# Agent Stack Changelog

All notable changes to the agent stack configuration will be documented in this file.

## [1.0.0] - 2026-04-15

### Added
- Initial agent stack implementation
- Five parallel review lanes (correctness, architecture, style, performance, regression)
- Security scanning with secret detection
- UI review integration for static HTML/CSS/JS
- Suppression system with markdown → JSON pipeline
- Process gates for protected path changes
- gStack orchestration without auto-production deployment
- Memory bootstrap for cross-session continuity

### Configuration
- Warn-only enforcement during initial rollout
- Protected paths: `/api/*`, `/login.html`, `/after-checkout.html`, `/success.html`
- CI workflows: agent-security.yml, agent-quality.yml