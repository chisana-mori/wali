# Findings

## Source Review
- `opencode/packages/app/src/context/global-sync.tsx` listens to `globalSDK.event.listen` and updates session/message/part/permission/question/todo/session_status/vcs based on event type.
- `opencode/packages/app/src/pages/layout.tsx` listens to global events for worktree status, permission/question notifications, and uses cooldown + toast/notification behavior.
- Current `opencode-web/frontend` is Solid + Vite with `contexts/GlobalSync.tsx` implementing a simplified SSE and event normalization layer.

## Target Repo
- Authoritative frontend location: `v2_agent/cloud-assistant/opencode-web/frontend`.
- Existing UI is Solid-based components (SessionSidebar, MessageList, overlays).

## Design Doc
- `opencode-web/docs/plans/2026-02-05-opencode-web-react-ai-elements-design.md` created and committed.

## Implementation Notes
- React + Vite migration requires updating `frontend/package.json`, `vite.config.ts`, `tsconfig.json`, and `src/main.tsx`.
- Solid components must be removed or rewritten since TypeScript checks all files in `src`.

## AI Elements Installation
- `src/components/ai-elements/message.tsx` now contains official ai-elements Message primitives.
- shadcn init updated `src/styles/index.css` with Tailwind 4 theme tokens.
- ai-elements provides `prompt-input` (not `composer`); used for input UI.
