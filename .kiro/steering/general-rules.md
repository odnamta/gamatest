# General Agent Rules

## Terminal Command Execution Guidelines

### Background Process Management
Use `controlBashProcess` for all long-running commands. Do not use `executeBash` for background processes.
- `controlBashProcess` is more robust and handles background processes correctly
- `executeBash` is simpler but lacks background process management capabilities

### Command Monitoring Protocol
After executing any shell command:
1. Use `getProcessOutput` immediately to check execution status
2. Monitor output for errors, warnings, or completion signals
3. Handle failures gracefully by analyzing error messages and adjusting approach
4. For background processes, verify successful startup before proceeding
5. Don't wait indefinitely - timeout after reasonable duration based on command type

## Error & Bug Handling (CRITICAL)

For every ERROR, BUG, or PROBLEM:
1. **STOP all changes** until root cause is identified with 100% certainty
2. Document what is failing, why it's failing, and any patterns or anomalies
3. No guesses—ensure findings are comprehensive before proposing fixes
4. Reflect on 5-7 different possible sources of the problem
5. Distill down to 1-2 most likely sources
6. Add logs to validate assumptions before implementing the actual fix
7. Use `Context7` MCP Server to investigate docs related to the issue

### Root Cause Verification
Before proceeding with any fix, confirm:
- The exact root cause has been identified
- No overlooked dependencies, edge cases, or related factors exist
- The proposed solution directly addresses the root cause with evidence and reasoning
- If any uncertainties remain, pause and reassess

## Feature Development Protocol

When adding NEW FEATURES:
1. Review existing project structure and database schema
2. Identify anything that may be affected
3. Keep things simple—reuse or centralize where possible
4. Think step by step to plan implementation
5. Document expected changes and testing strategy
6. **Ask 1-5+ clarifying questions** before proceeding (provide multiple choice options)
7. Use `Context7` MCP Server to improve plans

### Change Safety
- Make changes without impacting core functionality, other features, or flows
- Analyze behavior and dependencies to understand risks
- Communicate concerns before proceeding
- Test thoroughly to confirm no regressions or unintended effects
- Flag any out-of-scope changes for review
- Work with precision—pause if uncertain

## Responsive Design Requirements

- **Mobile-first approach** for all designs
- Fully responsive across all breakpoints
- Use modern UI/UX best practices
- Leverage Tailwind's built-in breakpoints (avoid custom breakpoints unless explicitly prompted)

### Responsiveness Implementation Plan
Before editing code:
1. Create a phased plan for implementing responsiveness
2. Start with largest layout components
3. Progressively refine down to smaller elements
4. Include clear steps for testing across all breakpoints
5. Share plan for review before proceeding

## MCP Server Usage

- Use `Context7` MCP Server to improve plans and investigate documentation
- Use `Supabase` MCP Server for schema inspection before writing database queries
