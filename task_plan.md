# Task Plan: React + AI Elements Frontend Migration

## Goal
Replace the Solid frontend with a React + Vite app that matches OpenCode event handling and UI behavior, using AI Elements-style components.

## Current Phase
Phase 3

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define technical approach
- [x] Create project structure if needed
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Execute the plan step by step
- [x] Write code to files before executing
- [ ] Test incrementally
- **Status:** in_progress

### Phase 4: Testing & Verification
- [ ] Verify all requirements met
- [ ] Document test results in progress.md
- [ ] Fix any issues found
- **Status:** pending

### Phase 5: Delivery
- [ ] Review all output files
- [ ] Ensure deliverables are complete
- [ ] Deliver to user
- **Status:** pending

## Key Questions
1. Which directory is the authoritative @opencode-web/frontend? (Using `v2_agent/cloud-assistant/opencode-web/frontend`)
2. Are backend endpoints stable for SSE and prompt actions? (Assuming current `/api` + `/event`)

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use React + Vite | Lowest risk, minimal tooling change |
| Implement AI Elements primitives locally | Avoid Next.js dependency while matching UI behavior |
| Mirror global-sync event handling | Ensure parity with OpenCode behaviors |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `npx --yes shadcn@latest init` timed out | 1 | Retry with longer timeout and/or use alternative `npm exec` |
| `npm exec --yes shadcn@latest init` timed out | 2 | Fall back to manual shadcn config files |
| `npx --yes ai-elements@latest add message` timed out | 3 | Use official component source directly from repository |
| `curl https://elements.ai-sdk.dev/api/registry/message.json` DNS failure | 4 | Ask user to provide registry URL or run CLI locally |
| `npx --yes ai-elements@latest add message` timed out | 5 | Request user to run CLI locally post-init |

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
